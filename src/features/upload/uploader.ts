import { searchFiles, createUploadSession, getUploadPartUrls, completeUpload } from '@/api/file'
import type { FileUploadPartInfo } from '@/api/types'
import type { TransferStrategy, DriveFileRecord } from '@/types/drive'
import { normalizeFolderPath } from '@/lib/path'
import { hashFileFull, hashFileSample } from '@/features/upload/hash'
import { putBlob } from '@/features/upload/transport'
import {
  DEFAULT_MULTIPART_CHUNK_SIZE,
  DEFAULT_MULTIPART_THRESHOLD,
  SAMPLE_HASH_THRESHOLD
} from '@/features/upload/config'
import type { UploadFileInput, UploadFileResult, ResumeState, NameConflictAction } from '@/features/upload/types'

const MIN_PART_SIZE = 5 * 1024 * 1024
const MAX_CONCURRENCY = 8
const UPLOAD_URL_BATCH = 20

type AbortWithResumeState = DOMException & { resumeState?: ResumeState | null }

function createAbortError() {
  return new DOMException('Upload aborted', 'AbortError')
}
function raiseIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw createAbortError()
}

function resolveTargetFolder(input: UploadFileInput) {
  return input.folderId?.trim() || 'root'
}

function resolveChunkSize(input: UploadFileInput) {
  return Math.max(input.chunkSize ?? DEFAULT_MULTIPART_CHUNK_SIZE, MIN_PART_SIZE)
}

function resolveConcurrency(input: UploadFileInput) {
  return Math.max(1, Math.min(input.multipartConcurrency ?? 3, MAX_CONCURRENCY))
}

function buildPartList(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => ({ part_number: from + i }))
}

function escapeSearch(v: string) {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function buildSearchQuery(parentId: string, name: string) {
  return `parent_file_id = "${escapeSearch(parentId)}" and (name = "${escapeSearch(name)}")`
}

function inferExtension(name: string) {
  const dot = name.lastIndexOf('.')
  return dot > 0 && dot + 1 < name.length ? name.slice(dot + 1).toLowerCase() : ''
}

function getPartSize(fileSize: number, chunkSize: number, partNumber: number) {
  const start = (partNumber - 1) * chunkSize
  return Math.max(0, Math.min(start + chunkSize, fileSize) - start)
}

function sanitizeCompleted(parts: number[], total: number) {
  return [...new Set(parts.filter(n => Number.isInteger(n) && n >= 1 && n <= total))].sort((a, b) => a - b)
}

function buildResumeState(
  uploadId: string,
  fileId: string,
  chunkSize: number,
  totalParts: number,
  completed: Set<number>
): ResumeState | null {
  if (!uploadId || !fileId) return null
  return {
    uploadId,
    fileId,
    chunkSize,
    totalParts,
    completedPartNumbers: sanitizeCompleted([...completed], totalParts)
  }
}

function normalizeResume(input: UploadFileInput, totalParts: number, chunkSize: number): ResumeState | null {
  const s = input.resumeState
  if (!s || s.chunkSize !== chunkSize || s.totalParts !== totalParts || !s.uploadId || !s.fileId) return null
  return { ...s, completedPartNumbers: sanitizeCompleted(s.completedPartNumbers, totalParts) }
}

function makePendingRecord(
  input: UploadFileInput,
  strategy: TransferStrategy,
  fileId: string,
  fileName: string
): DriveFileRecord {
  const now = new Date().toISOString()
  return {
    id: fileId,
    fileName,
    fileExtension: inferExtension(fileName),
    folderId: resolveTargetFolder(input),
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

function makeCompletedRecord(
  completed: Awaited<ReturnType<typeof completeUpload>>,
  input: UploadFileInput,
  strategy: TransferStrategy
): DriveFileRecord {
  const name = completed.name || input.file.name
  return {
    id: completed.file_id,
    fileName: name,
    fileExtension: completed.file_extension || inferExtension(name),
    folderId: completed.parent_file_id || resolveTargetFolder(input),
    folderPath: normalizeFolderPath(input.folderPath ?? ''),
    contentType: completed.content_type || input.file.type || 'application/octet-stream',
    fileSize: (completed.size as number | undefined) ?? input.file.size,
    fileHash: (completed.content_hash as string | undefined) || '',
    fileSampleHash: '',
    objectKey: '',
    bucket: '',
    strategy,
    createdAt: (completed.created_at as string | undefined) || '',
    updatedAt: (completed.updated_at as string | undefined) || ''
  }
}

function emitProgress(input: UploadFileInput, loaded: number, total: number) {
  const safeTotal = Math.max(1, total)
  input.onProgress?.({ loaded, total, percent: (loaded / safeTotal) * 100 })
}

// 单调递增进度上报
function makeProgressReporter(input: UploadFileInput, total: number, initial = 0) {
  const bounded = Math.max(1, total)
  let last = Math.min(bounded, Math.max(0, initial))
  emitProgress(input, last, bounded)
  return {
    report(next: number) {
      const n = Math.min(bounded, Math.max(0, next))
      if (n <= last) return last
      last = n
      emitProgress(input, last, bounded)
      return last
    },
    force(next: number) {
      const n = Math.min(bounded, Math.max(0, next))
      if (n > last) last = n
      emitProgress(input, last, bounded)
      return last
    }
  }
}

async function uploadParts(
  input: UploadFileInput,
  partInfoList: FileUploadPartInfo[],
  chunkSize: number,
  committedRef: { value: number },
  reporter: ReturnType<typeof makeProgressReporter>,
  onPartDone?: (partNumber: number) => void
) {
  const concurrency = resolveConcurrency(input)
  const sorted = [...partInfoList].sort((a, b) => a.part_number - b.part_number)
  const inFlight = new Map<number, number>()
  let idx = 0

  await Promise.all(
    Array.from({ length: Math.min(concurrency, sorted.length) }, async () => {
      while (true) {
        const i = idx++
        if (i >= sorted.length) return
        const part = sorted[i]
        raiseIfAborted(input.signal)

        const start = (part.part_number - 1) * chunkSize
        const blob = input.file.slice(start, Math.min(start + chunkSize, input.file.size))

        await putBlob({
          uploadUrl: part.upload_url,
          blob,
          contentType: input.file.type || 'application/octet-stream',
          signal: input.signal,
          onProgress: loaded => {
            inFlight.set(part.part_number, loaded)
            reporter.report(committedRef.value + [...inFlight.values()].reduce((s, v) => s + v, 0))
          }
        })

        committedRef.value += blob.size
        inFlight.delete(part.part_number)
        reporter.report(committedRef.value)
        onPartDone?.(part.part_number)
      }
    })
  )
}

async function computePreHash(input: UploadFileInput): Promise<string> {
  if (input.file.size >= SAMPLE_HASH_THRESHOLD) {
    input.onStageChange?.('hashing', '快速预哈希')
    return hashFileSample(
      input.file,
      (l, t) => input.onStageChange?.('hashing', `快速预哈希 ${((l / Math.max(1, t)) * 100).toFixed(1)}%`),
      input.signal
    )
  }
  input.onStageChange?.('hashing', '计算完整预哈希')
  return hashFileFull(
    input.file,
    (l, t) => input.onStageChange?.('hashing', `计算完整预哈希 ${((l / Math.max(1, t)) * 100).toFixed(1)}%`),
    input.signal
  )
}

export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  if (!input.file) throw new Error('未选择文件')
  raiseIfAborted(input.signal)

  const folderId = resolveTargetFolder(input)
  const chunkSize = resolveChunkSize(input)
  const threshold = input.multipartThreshold ?? DEFAULT_MULTIPART_THRESHOLD
  const shouldMulti = input.file.size >= threshold
  const totalParts = shouldMulti ? Math.max(1, Math.ceil(input.file.size / chunkSize)) : 1
  const strategy: TransferStrategy = totalParts > 1 ? 'multipart' : 'single'

  const completed = new Set<number>()
  let uploadId = '',
    fileId = '',
    resolvedName = input.file.name,
    rapidUpload = false
  let initialParts: FileUploadPartInfo[] = []

  try {
    const resume = normalizeResume(input, totalParts, chunkSize)
    if (resume) {
      uploadId = resume.uploadId
      fileId = resume.fileId
      resume.completedPartNumbers.forEach(n => completed.add(n))
      input.onResumeStateChange?.(resume)
      input.onStageChange?.('uploading', '继续上传...')
    } else {
      // 冲突检测
      let checkNameMode: 'auto_rename' | 'refuse' | 'overwrite' = 'auto_rename'
      input.onStageChange?.('checking', '检查文件名冲突...')

      const search = await searchFiles(buildSearchQuery(folderId, input.file.name), 1)
      if (search.items.length > 0) {
        const existing = search.items[0]
        const action: NameConflictAction =
          (await input.onNameConflict?.({
            fileName: input.file.name,
            folderId,
            existingFileId: existing.file_id,
            existingFileName: existing.name
          })) ?? 'skip'

        if (action === 'skip') {
          emitProgress(input, input.file.size, input.file.size)
          input.onResumeStateChange?.(null)
          input.onStageChange?.('done', '跳过：同名文件已存在')
          return {
            file: {
              id: existing.file_id,
              fileName: existing.name,
              fileExtension: inferExtension(existing.name),
              folderId,
              folderPath: normalizeFolderPath(input.folderPath ?? ''),
              contentType: input.file.type || 'application/octet-stream',
              fileSize: existing.size,
              fileHash: '',
              fileSampleHash: '',
              objectKey: '',
              bucket: '',
              strategy: 'instant',
              createdAt: existing.created_at || '',
              updatedAt: existing.updated_at || ''
            },
            strategy: 'instant',
            instantUpload: true
          }
        }
        checkNameMode = action === 'overwrite' ? 'overwrite' : 'auto_rename'
      }

      const preHash = await computePreHash(input)
      raiseIfAborted(input.signal)

      input.onStageChange?.('checking', '创建上传会话...')
      const session = await createUploadSession({
        parentFileId: folderId,
        name: input.file.name,
        size: input.file.size,
        checkNameMode,
        partInfoList: buildPartList(1, Math.min(UPLOAD_URL_BATCH, totalParts)),
        preHash,
        contentType: input.file.type || 'application/octet-stream',
        chunkSize,
        localModifiedAt: input.file.lastModified > 0 ? new Date(input.file.lastModified).toISOString() : undefined
      })

      uploadId = session.upload_id
      fileId = session.file_id
      resolvedName = session.file_name || input.file.name
      rapidUpload = Boolean(session.rapid_upload)
      initialParts = session.part_info_list ?? []
      input.onResumeStateChange?.(buildResumeState(uploadId, fileId, chunkSize, totalParts, completed))
    }

    const committedRef = {
      value: [...completed].reduce((s, n) => s + getPartSize(input.file.size, chunkSize, n), 0)
    }

    if (!rapidUpload) {
      input.onStageChange?.('uploading', '上传文件...')
      const reporter = makeProgressReporter(input, input.file.size, committedRef.value)

      while (true) {
        raiseIfAborted(input.signal)
        const pending: number[] = []
        for (let n = 1; n <= totalParts; n++) {
          if (!completed.has(n)) {
            pending.push(n)
            if (pending.length >= UPLOAD_URL_BATCH) break
          }
        }
        if (pending.length === 0) break

        let parts: FileUploadPartInfo[] = []
        if (initialParts.length > 0) {
          const map = new Map(initialParts.map(p => [p.part_number, p]))
          const batch = pending.map(n => map.get(n)).filter((p): p is FileUploadPartInfo => Boolean(p))
          if (batch.length === pending.length) parts = batch
          initialParts = []
        }

        if (parts.length === 0) {
          const r = await getUploadPartUrls(fileId, uploadId, pending)
          parts = r.part_info_list
        }

        await uploadParts(input, parts, chunkSize, committedRef, reporter, n => {
          if (!completed.has(n)) {
            completed.add(n)
            input.onResumeStateChange?.(buildResumeState(uploadId, fileId, chunkSize, totalParts, completed))
          }
        })
      }

      reporter.force(input.file.size)
    } else {
      input.onStageChange?.('finalizing', '秒传命中，完成中...')
    }

    raiseIfAborted(input.signal)
    input.onStageChange?.('finalizing', '服务端确认中...')

    if (fileId) {
      input.onBeforeComplete?.(makePendingRecord(input, strategy, fileId, resolvedName))
    }

    const completedFile = await completeUpload(fileId, uploadId)
    emitProgress(input, input.file.size, input.file.size)
    input.onResumeStateChange?.(null)
    input.onStageChange?.('done', rapidUpload ? '秒传完成' : '上传完成')

    return { file: makeCompletedRecord(completedFile, input, strategy), strategy, instantUpload: false }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      const state = buildResumeState(uploadId, fileId, chunkSize, totalParts, completed)
      input.onResumeStateChange?.(state)
      const abortErr = error as AbortWithResumeState
      abortErr.resumeState = state
      throw abortErr
    }
    throw error
  }
}
