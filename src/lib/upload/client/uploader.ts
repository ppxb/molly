import {
  completeFileRequest,
  createWithFoldersFileRequest,
  getUploadURLFileRequest,
  type FileCompleteResponse,
  type FileSearchItem,
  type FileUploadPartInfo,
  searchFileRequest
} from '@/lib/upload/client/api'
import { hashFileSampleSHA256, hashFileSHA256 } from '@/lib/upload/client/hash'
import { uploadBlobWithProgress } from '@/lib/upload/client/transport'
import {
  DEFAULT_MULTIPART_CHUNK_SIZE,
  DEFAULT_MULTIPART_THRESHOLD,
  SAMPLE_HASH_THRESHOLD,
  type UploadedFileRecord,
  type UploadStage,
  type UploadStrategy
} from '@/lib/upload/shared'

const MIN_MULTIPART_PART_SIZE = 5 * 1024 * 1024
const UPLOAD_URL_BATCH_SIZE = 20

interface UploadProgressPayload {
  loaded: number
  total: number
  percent: number
}

interface UploadCallbacks {
  onStageChange?: (stage: UploadStage, message: string) => void
  onProgress?: (progress: UploadProgressPayload) => void
}

interface UploadFileInput extends UploadCallbacks {
  file: File
  folderId?: string
  folderPath?: string
  signal?: AbortSignal
  multipartThreshold?: number
  chunkSize?: number
  multipartConcurrency?: number
}

export interface UploadFileResult {
  file: UploadedFileRecord
  strategy: UploadStrategy
  instantUpload: boolean
}

function createAbortError() {
  return new DOMException('Upload aborted', 'AbortError')
}

function raiseIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

function resolveTargetFolderId(input: UploadFileInput) {
  return input.folderId?.trim() || 'root'
}

function resolveTargetFolderPath(input: UploadFileInput) {
  return input.folderPath?.trim() || ''
}

function emitProgress(callbacks: UploadCallbacks, loaded: number, total: number) {
  const safeTotal = Math.max(1, total)
  callbacks.onProgress?.({
    loaded,
    total,
    percent: (loaded / safeTotal) * 100
  })
}

function createMonotonicProgressReporter(callbacks: UploadCallbacks, total: number, initialLoaded = 0) {
  const boundedTotal = Math.max(1, total)
  let lastLoaded = Math.min(boundedTotal, Math.max(0, initialLoaded))

  emitProgress(callbacks, lastLoaded, boundedTotal)

  const normalizeLoaded = (nextLoaded: number) => Math.min(boundedTotal, Math.max(0, nextLoaded))

  return {
    report(nextLoaded: number) {
      const normalized = normalizeLoaded(nextLoaded)
      if (normalized <= lastLoaded) {
        return lastLoaded
      }

      lastLoaded = normalized
      emitProgress(callbacks, lastLoaded, boundedTotal)
      return lastLoaded
    },
    force(nextLoaded: number) {
      const normalized = normalizeLoaded(nextLoaded)
      if (normalized > lastLoaded) {
        lastLoaded = normalized
      }

      emitProgress(callbacks, lastLoaded, boundedTotal)
      return lastLoaded
    }
  }
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  const taskCount = Math.max(1, Math.min(concurrency, items.length))
  let currentIndex = 0

  await Promise.all(
    Array.from({ length: taskCount }).map(async () => {
      while (true) {
        const index = currentIndex
        if (index >= items.length) {
          return
        }
        currentIndex += 1
        await worker(items[index])
      }
    })
  )
}

function escapeSearchValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildSearchQuery(parentFileId: string, fileName: string) {
  return `parent_file_id = "${escapeSearchValue(parentFileId)}" and (name = "${escapeSearchValue(fileName)}")`
}

function buildPartInfoList(fromPart: number, toPart: number) {
  const partInfoList: Array<{ part_number: number }> = []
  for (let partNumber = fromPart; partNumber <= toPart; partNumber += 1) {
    partInfoList.push({ part_number: partNumber })
  }
  return partInfoList
}

function inferFileExtension(fileName: string) {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot + 1 >= fileName.length) {
    return ''
  }
  return fileName.slice(dot + 1).toLowerCase()
}

function mapSearchItemToUploadedFile(item: FileSearchItem, input: UploadFileInput): UploadedFileRecord {
  return {
    id: item.file_id,
    fileName: item.name,
    fileExtension: inferFileExtension(item.name),
    folderId: item.parent_file_id,
    folderPath: resolveTargetFolderPath(input),
    contentType: input.file.type || 'application/octet-stream',
    fileSize: item.size,
    fileHash: '',
    fileSampleHash: '',
    objectKey: '',
    bucket: '',
    strategy: 'instant',
    createdAt: item.created_at || '',
    updatedAt: item.updated_at || ''
  }
}

function mapCompletedFileToUploadedFile(
  completed: FileCompleteResponse,
  input: UploadFileInput,
  strategy: UploadStrategy
): UploadedFileRecord {
  const fileName = completed.name || input.file.name
  const fileExtension = completed.file_extension || inferFileExtension(fileName)

  return {
    id: completed.file_id,
    fileName,
    fileExtension,
    folderId: completed.parent_file_id || resolveTargetFolderId(input),
    folderPath: resolveTargetFolderPath(input),
    contentType: completed.content_type || input.file.type || 'application/octet-stream',
    fileSize: completed.size ?? input.file.size,
    fileHash: completed.content_hash || '',
    fileSampleHash: '',
    objectKey: '',
    bucket: '',
    strategy,
    createdAt: completed.created_at || '',
    updatedAt: completed.updated_at || ''
  }
}

async function computePreHash(input: UploadFileInput) {
  if (input.file.size >= SAMPLE_HASH_THRESHOLD) {
    input.onStageChange?.('hashing', 'Calculating pre-hash from sampled content...')
    return hashFileSampleSHA256(
      input.file,
      (loaded, total) => {
        const percent = (loaded / Math.max(1, total)) * 100
        input.onStageChange?.('hashing', `Calculating pre-hash ${percent.toFixed(1)}%`)
      },
      input.signal
    )
  }

  input.onStageChange?.('hashing', 'Calculating pre-hash...')
  return hashFileSHA256(
    input.file,
    (loaded, total) => {
      const percent = (loaded / Math.max(1, total)) * 100
      input.onStageChange?.('hashing', `Calculating pre-hash ${percent.toFixed(1)}%`)
    },
    input.signal
  )
}

function resolveChunkSize(input: UploadFileInput) {
  const byInput = input.chunkSize ?? DEFAULT_MULTIPART_CHUNK_SIZE
  return Math.max(byInput, MIN_MULTIPART_PART_SIZE)
}

function resolveConcurrency(input: UploadFileInput) {
  return Math.max(1, Math.min(input.multipartConcurrency ?? 3, 8))
}

async function uploadPartBatch(
  input: UploadFileInput,
  partInfoList: FileUploadPartInfo[],
  chunkSize: number,
  committedBytesRef: { value: number },
  progressReporter: ReturnType<typeof createMonotonicProgressReporter>
) {
  const orderedPartInfoList = [...partInfoList].sort((left, right) => left.part_number - right.part_number)
  const inFlightBytes = new Map<number, number>()

  await runWithConcurrency(orderedPartInfoList, resolveConcurrency(input), async partInfo => {
    raiseIfAborted(input.signal)

    const start = (partInfo.part_number - 1) * chunkSize
    const end = Math.min(start + chunkSize, input.file.size)
    const blob = input.file.slice(start, end)

    await uploadBlobWithProgress({
      uploadUrl: partInfo.upload_url,
      blob,
      contentType: input.file.type || 'application/octet-stream',
      signal: input.signal,
      onProgress: loaded => {
        inFlightBytes.set(partInfo.part_number, loaded)
        const transientUploadedBytes = Array.from(inFlightBytes.values()).reduce((sum, value) => sum + value, 0)
        progressReporter.report(committedBytesRef.value + transientUploadedBytes)
      }
    })

    committedBytesRef.value += blob.size
    inFlightBytes.delete(partInfo.part_number)
    progressReporter.report(committedBytesRef.value)
  })
}

export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  if (!input.file) {
    throw new Error('No file selected')
  }

  raiseIfAborted(input.signal)

  const folderId = resolveTargetFolderId(input)
  const chunkSize = resolveChunkSize(input)
  const shouldMultipart = input.file.size >= (input.multipartThreshold ?? DEFAULT_MULTIPART_THRESHOLD)
  const totalParts = shouldMultipart ? Math.max(1, Math.ceil(input.file.size / chunkSize)) : 1
  const strategy: UploadStrategy = totalParts > 1 ? 'multipart' : 'single'

  input.onStageChange?.('checking', 'Checking if a file with the same name already exists...')
  const searchResult = await searchFileRequest({
    query: buildSearchQuery(folderId, input.file.name),
    order_by: 'name ASC',
    limit: 1
  })

  if (searchResult.items.length > 0) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', 'Existing file found, upload skipped')
    return {
      file: mapSearchItemToUploadedFile(searchResult.items[0], input),
      strategy: 'instant',
      instantUpload: true
    }
  }

  const preHash = await computePreHash(input)
  raiseIfAborted(input.signal)

  const firstBatchEnd = Math.min(UPLOAD_URL_BATCH_SIZE, totalParts)
  const firstBatchParts = buildPartInfoList(1, firstBatchEnd)
  const localModifiedAt = input.file.lastModified > 0 ? new Date(input.file.lastModified).toISOString() : undefined

  input.onStageChange?.('checking', 'Creating upload session...')
  const createResult = await createWithFoldersFileRequest({
    part_info_list: firstBatchParts,
    parent_file_id: folderId,
    name: input.file.name,
    type: 'file',
    check_name_mode: 'auto_rename',
    size: input.file.size,
    create_scene: 'file_upload',
    device_name: 'web',
    local_modified_at: localModifiedAt,
    pre_hash: preHash,
    content_type: input.file.type || 'application/octet-stream',
    chunk_size: chunkSize
  })

  if (createResult.rapid_upload) {
    input.onStageChange?.('finalizing', 'Rapid upload hit, finalizing...')
  } else {
    input.onStageChange?.('uploading', 'Uploading file parts...')
    const progressReporter = createMonotonicProgressReporter(input, input.file.size, 0)
    const committedBytesRef = { value: 0 }
    let nextPartNumber = 1
    let partInfoList = createResult.part_info_list ?? []

    while (nextPartNumber <= totalParts) {
      if (partInfoList.length === 0) {
        const batchEnd = Math.min(nextPartNumber + UPLOAD_URL_BATCH_SIZE - 1, totalParts)
        const uploadURLResult = await getUploadURLFileRequest({
          upload_id: createResult.upload_id,
          file_id: createResult.file_id,
          part_info_list: buildPartInfoList(nextPartNumber, batchEnd)
        })
        partInfoList = uploadURLResult.part_info_list
      }

      await uploadPartBatch(input, partInfoList, chunkSize, committedBytesRef, progressReporter)
      const maxPartNumber = Math.max(...partInfoList.map(item => item.part_number))
      nextPartNumber = maxPartNumber + 1
      partInfoList = []
    }

    progressReporter.force(input.file.size)
  }

  raiseIfAborted(input.signal)
  input.onStageChange?.('finalizing', 'Completing upload...')
  const completed = await completeFileRequest({
    upload_id: createResult.upload_id,
    file_id: createResult.file_id
  })

  emitProgress(input, input.file.size, input.file.size)
  input.onStageChange?.('done', 'Upload completed')
  return {
    file: mapCompletedFileToUploadedFile(completed, input, strategy),
    strategy,
    instantUpload: false
  }
}
