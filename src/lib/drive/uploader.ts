import type { FileUploadPartInfo } from '@/lib/drive/api'
import {
  completeFileRequest,
  createWithFoldersFileRequest,
  getUploadURLFileRequest,
  searchFileRequest
} from '@/lib/drive/api'
import {
  buildPartInfoList,
  buildSearchQuery,
  raiseIfAborted,
  resolveChunkSize,
  resolveTargetFolderID,
  UPLOAD_URL_BATCH_SIZE
} from '@/lib/drive/upload/helpers'
import { computePreHash } from '@/lib/drive/upload/hashing'
import { mapCompletedFileToUploadedFile, mapSearchItemToUploadedFile } from '@/lib/drive/upload/mappers'
import { uploadPartBatch } from '@/lib/drive/upload/multipart'
import { createMonotonicProgressReporter, emitProgress } from '@/lib/drive/upload/progress'
import type { TransferFileInput, TransferFileResult, NameConflictAction, ResumeState } from '@/lib/drive/upload/types'
import { DEFAULT_MULTIPART_THRESHOLD } from '@/lib/drive/types'
import type { TransferStrategy, DriveFileRecord } from '@/lib/drive/types'

export type { TransferFileInput, TransferFileResult, NameConflictAction, ResumeState } from '@/lib/drive/upload/types'

type UploadAbortErrorWithResumeState = DOMException & { resumeState?: ResumeState | null }

function isAbortError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === 'AbortError'
}

function getPartSize(fileSize: number, chunkSize: number, partNumber: number) {
  const start = (partNumber - 1) * chunkSize
  const end = Math.min(start + chunkSize, fileSize)
  return Math.max(0, end - start)
}

function sanitizeCompletedPartNumbers(completedPartNumbers: number[], totalParts: number) {
  const partSet = new Set<number>()
  for (const partNumber of completedPartNumbers) {
    if (!Number.isInteger(partNumber)) {
      continue
    }
    if (partNumber < 1 || partNumber > totalParts) {
      continue
    }
    partSet.add(partNumber)
  }
  return [...partSet].sort((left, right) => left - right)
}

function normalizeResumeState(input: TransferFileInput, totalParts: number, chunkSize: number) {
  const state = input.resumeState
  if (!state) {
    return null
  }
  if (state.chunkSize !== chunkSize || state.totalParts !== totalParts) {
    return null
  }
  if (!state.uploadId || !state.fileId) {
    return null
  }

  const completedPartNumbers = sanitizeCompletedPartNumbers(state.completedPartNumbers, totalParts)
  return {
    uploadId: state.uploadId,
    fileId: state.fileId,
    chunkSize,
    totalParts,
    completedPartNumbers
  } satisfies ResumeState
}

function buildResumeState(
  uploadId: string,
  fileId: string,
  chunkSize: number,
  totalParts: number,
  completedPartNumbersSet: Set<number>
) {
  if (!uploadId || !fileId) {
    return null
  }

  const completedPartNumbers = sanitizeCompletedPartNumbers([...completedPartNumbersSet], totalParts)
  return {
    uploadId,
    fileId,
    chunkSize,
    totalParts,
    completedPartNumbers
  } satisfies ResumeState
}

function splitFileName(fileName: string) {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot + 1 >= fileName.length) {
    return {
      baseName: fileName,
      extension: ''
    }
  }
  return {
    baseName: fileName.slice(0, dot),
    extension: fileName.slice(dot)
  }
}

function inferFileExtension(fileName: string) {
  const { extension } = splitFileName(fileName)
  return extension.replace('.', '').toLowerCase()
}

function mapPendingFileToUploadedFile(
  input: TransferFileInput,
  strategy: TransferStrategy,
  fileID: string,
  fileName: string
): DriveFileRecord {
  const now = new Date().toISOString()
  return {
    id: fileID,
    fileName,
    fileExtension: inferFileExtension(fileName),
    folderId: resolveTargetFolderID(input),
    folderPath: input.folderPath?.trim() || '',
    contentType: input.file.type || 'application/octet-stream',
    fileSize: input.file.size,
    fileHash: '',
    fileSampleHash: '',
    objectKey: '',
    bucket: '',
    strategy,
    createdAt: now,
    updatedAt: now
  }
}

export async function uploadFile(input: TransferFileInput): Promise<TransferFileResult> {
  if (!input.file) {
    throw new Error('No file selected')
  }

  raiseIfAborted(input.signal)

  const folderID = resolveTargetFolderID(input)
  const chunkSize = resolveChunkSize(input)
  const shouldMultipart = input.file.size >= (input.multipartThreshold ?? DEFAULT_MULTIPART_THRESHOLD)
  const totalParts = shouldMultipart ? Math.max(1, Math.ceil(input.file.size / chunkSize)) : 1
  const strategy: TransferStrategy = totalParts > 1 ? 'multipart' : 'single'

  const completedPartNumbers = new Set<number>()
  let uploadID = ''
  let fileID = ''
  let resolvedFileName = input.file.name
  let rapidUpload = false
  let initialPartInfoList: FileUploadPartInfo[] = []

  try {
    const resumeState = normalizeResumeState(input, totalParts, chunkSize)
    if (resumeState) {
      uploadID = resumeState.uploadId
      fileID = resumeState.fileId
      resolvedFileName = input.file.name
      for (const partNumber of resumeState.completedPartNumbers) {
        completedPartNumbers.add(partNumber)
      }
      input.onResumeStateChange?.(resumeState)
      input.onStageChange?.('uploading', 'Resuming upload...')
    } else {
      let uploadFileName = input.file.name
      let checkNameMode: 'auto_rename' | 'refuse' | 'overwrite' = 'auto_rename'

      input.onStageChange?.('checking', 'Checking if a file with the same name already exists...')
      const searchResult = await searchFileRequest({
        query: buildSearchQuery(folderID, uploadFileName),
        order_by: 'name ASC',
        limit: 1
      })

      if (searchResult.items.length > 0) {
        const existingFile = searchResult.items[0]
        const conflictAction: NameConflictAction =
          (await input.onNameConflict?.({
            fileName: uploadFileName,
            folderId: folderID,
            existingFileId: existingFile.file_id,
            existingFileName: existingFile.name
          })) ?? 'skip'

        if (conflictAction === 'skip') {
          emitProgress(input, input.file.size, input.file.size)
          input.onResumeStateChange?.(null)
          input.onStageChange?.('done', 'Skipped: file with same name exists')
          return {
            file: mapSearchItemToUploadedFile(existingFile, input),
            strategy: 'instant',
            instantUpload: true
          }
        }

        if (conflictAction === 'overwrite') {
          // Aliyun semantics: create_with_folders handles replacement with check_name_mode=overwrite.
          checkNameMode = 'overwrite'
        } else {
          // Aliyun semantics: create_with_folders handles coexistence with check_name_mode=auto_rename.
          checkNameMode = 'auto_rename'
        }
      }

      const preHash = await computePreHash(input)
      raiseIfAborted(input.signal)

      input.onStageChange?.('checking', 'Creating upload session...')
      const firstBatchEnd = Math.min(UPLOAD_URL_BATCH_SIZE, totalParts)
      const localModifiedAt = input.file.lastModified > 0 ? new Date(input.file.lastModified).toISOString() : undefined
      const createResult = await createWithFoldersFileRequest({
        part_info_list: buildPartInfoList(1, firstBatchEnd),
        parent_file_id: folderID,
        name: uploadFileName,
        type: 'file',
        check_name_mode: checkNameMode,
        size: input.file.size,
        create_scene: 'file_upload',
        device_name: 'web',
        local_modified_at: localModifiedAt,
        pre_hash: preHash,
        content_type: input.file.type || 'application/octet-stream',
        chunk_size: chunkSize
      })

      uploadID = createResult.upload_id
      fileID = createResult.file_id
      resolvedFileName = createResult.file_name || uploadFileName
      rapidUpload = Boolean(createResult.rapid_upload)
      initialPartInfoList = createResult.part_info_list ?? []
      input.onResumeStateChange?.(buildResumeState(uploadID, fileID, chunkSize, totalParts, completedPartNumbers))
    }

    const committedBytesRef = {
      value: [...completedPartNumbers].reduce(
        (sum, partNumber) => sum + getPartSize(input.file.size, chunkSize, partNumber),
        0
      )
    }

    if (!rapidUpload) {
      input.onStageChange?.('uploading', 'Uploading file parts...')
      const progressReporter = createMonotonicProgressReporter(input, input.file.size, committedBytesRef.value)

      while (true) {
        raiseIfAborted(input.signal)

        const pendingPartNumbers: number[] = []
        for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
          if (completedPartNumbers.has(partNumber)) {
            continue
          }
          pendingPartNumbers.push(partNumber)
          if (pendingPartNumbers.length >= UPLOAD_URL_BATCH_SIZE) {
            break
          }
        }

        if (pendingPartNumbers.length === 0) {
          break
        }

        let partInfoList: FileUploadPartInfo[] = []
        if (initialPartInfoList.length > 0) {
          const initialPartInfoMap = new Map(initialPartInfoList.map(item => [item.part_number, item]))
          const initialBatch = pendingPartNumbers
            .map(partNumber => initialPartInfoMap.get(partNumber))
            .filter((item): item is FileUploadPartInfo => Boolean(item))
          if (initialBatch.length === pendingPartNumbers.length) {
            partInfoList = initialBatch
          }
          initialPartInfoList = []
        }

        if (partInfoList.length === 0) {
          const uploadURLResult = await getUploadURLFileRequest({
            upload_id: uploadID,
            file_id: fileID,
            part_info_list: pendingPartNumbers.map(partNumber => ({ part_number: partNumber }))
          })
          partInfoList = uploadURLResult.part_info_list
        }

        await uploadPartBatch(input, partInfoList, chunkSize, committedBytesRef, progressReporter, partNumber => {
          if (completedPartNumbers.has(partNumber)) {
            return
          }
          completedPartNumbers.add(partNumber)
          input.onResumeStateChange?.(buildResumeState(uploadID, fileID, chunkSize, totalParts, completedPartNumbers))
        })
      }

      progressReporter.force(input.file.size)
    } else {
      input.onStageChange?.('finalizing', 'Rapid upload hit, finalizing...')
    }

    raiseIfAborted(input.signal)
    input.onStageChange?.('finalizing', 'Finalizing on server...')
    if (fileID) {
      input.onBeforeComplete?.(mapPendingFileToUploadedFile(input, strategy, fileID, resolvedFileName))
    }
    const completed = await completeFileRequest({
      upload_id: uploadID,
      file_id: fileID
    })

    emitProgress(input, input.file.size, input.file.size)
    input.onResumeStateChange?.(null)
    input.onStageChange?.('done', 'Upload completed')
    return {
      file: mapCompletedFileToUploadedFile(completed, input, strategy),
      strategy,
      instantUpload: false
    }
  } catch (error) {
    if (isAbortError(error)) {
      const resumeState = buildResumeState(uploadID, fileID, chunkSize, totalParts, completedPartNumbers)
      input.onResumeStateChange?.(resumeState)
      const abortError = error as UploadAbortErrorWithResumeState
      abortError.resumeState = resumeState
      throw abortError
    }
    throw error
  }
}
