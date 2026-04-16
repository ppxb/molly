import {
  completeMultipartUploadRequest,
  completeSingleUploadRequest,
  getMultipartPartUrlRequest,
  initMultipartUploadRequest,
  initSingleUploadRequest,
  instantCheckRequest,
  reportMultipartPartCompletedRequest
} from '@/lib/upload/client/api'
import { hashFileSHA256 } from '@/lib/upload/client/hash'
import { clearResumeSessionId, getResumeSessionId, setResumeSessionId } from '@/lib/upload/client/resume-storage'
import { uploadBlobWithProgress } from '@/lib/upload/client/transport'
import {
  DEFAULT_MULTIPART_CHUNK_SIZE,
  DEFAULT_MULTIPART_THRESHOLD,
  type UploadedFileRecord,
  type UploadStage,
  type UploadStrategy
} from '@/lib/upload/shared'

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

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

function raiseIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Upload aborted', 'AbortError')
  }
}

async function runWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  const taskCount = Math.max(1, Math.min(concurrency, items.length))
  let currentIndex = 0

  await Promise.all(
    Array.from({ length: taskCount }).map(async () => {
      while (currentIndex < items.length) {
        const nextItem = items[currentIndex]
        currentIndex += 1
        await worker(nextItem)
      }
    })
  )
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
    },
    current() {
      return lastLoaded
    }
  }
}

function formatUploadSpeed(bytesPerSecond: number) {
  const kbPerSecond = Math.max(0, bytesPerSecond) / 1024
  if (kbPerSecond < 1024) {
    return `${kbPerSecond.toFixed(kbPerSecond >= 100 ? 0 : kbPerSecond >= 10 ? 1 : 2)} KB/s`
  }

  const mbPerSecond = kbPerSecond / 1024
  return `${mbPerSecond.toFixed(mbPerSecond >= 100 ? 0 : mbPerSecond >= 10 ? 1 : 2)} MB/s`
}

async function uploadSingleFile(input: UploadFileInput & { fileHash: string }): Promise<UploadFileResult> {
  input.onStageChange?.('checking', '检查秒传索引...')
  const singleInit = await initSingleUploadRequest({
    fileName: input.file.name,
    contentType: input.file.type || 'application/octet-stream',
    fileSize: input.file.size,
    fileHash: input.fileHash
  })

  if (singleInit.instantUpload && singleInit.file) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', '秒传命中，复用已有对象')
    return {
      file: singleInit.file,
      strategy: 'instant',
      instantUpload: true
    }
  }

  if (!singleInit.session) {
    throw new Error('Missing single-upload session')
  }

  input.onStageChange?.('uploading', '上传文件中...')
  const progress = createMonotonicProgressReporter(input, input.file.size, 0)
  await uploadBlobWithProgress({
    uploadUrl: singleInit.session.uploadUrl,
    blob: input.file,
    contentType: input.file.type || 'application/octet-stream',
    signal: input.signal,
    onProgress: loaded => {
      progress.report(loaded)
    }
  })

  raiseIfAborted(input.signal)
  input.onStageChange?.('finalizing', '提交文件元数据...')
  const complete = await completeSingleUploadRequest({
    sessionId: singleInit.session.sessionId
  })

  progress.force(input.file.size)
  input.onStageChange?.('done', '上传完成')
  return {
    file: complete.file,
    strategy: 'single',
    instantUpload: false
  }
}

async function uploadMultipartFile(input: UploadFileInput & { fileHash: string }): Promise<UploadFileResult> {
  const chunkSize = Math.max(input.chunkSize ?? DEFAULT_MULTIPART_CHUNK_SIZE, 5 * 1024 * 1024)
  const concurrency = Math.max(1, Math.min(input.multipartConcurrency ?? 3, 6))
  const resumeSessionId = getResumeSessionId(input.fileHash, input.file.size) ?? undefined

  input.onStageChange?.('checking', resumeSessionId ? '检测到历史任务，准备断点续传...' : '创建分片上传会话...')
  const init = await initMultipartUploadRequest({
    fileName: input.file.name,
    contentType: input.file.type || 'application/octet-stream',
    fileSize: input.file.size,
    fileHash: input.fileHash,
    chunkSize,
    resumeSessionId
  })

  if (init.instantUpload && init.file) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', '秒传命中，复用已有对象')
    clearResumeSessionId(input.fileHash, input.file.size)
    return {
      file: init.file,
      strategy: 'instant',
      instantUpload: true
    }
  }

  const session = init.session
  if (!session) {
    throw new Error('Missing multipart session')
  }

  setResumeSessionId(input.fileHash, input.file.size, session.sessionId)

  const completedPartSizes = new Map<number, number>()
  for (const part of session.uploadedParts) {
    completedPartSizes.set(part.partNumber, part.size)
  }

  const pendingPartNumbers: number[] = []
  for (let partNumber = 1; partNumber <= session.totalParts; partNumber += 1) {
    if (!completedPartSizes.has(partNumber)) {
      pendingPartNumbers.push(partNumber)
    }
  }

  let committedLoaded = Array.from(completedPartSizes.values()).reduce((sum, size) => sum + size, 0)
  const inFlightLoaded = new Map<number, number>()
  const progress = createMonotonicProgressReporter(input, input.file.size, committedLoaded)
  input.onStageChange?.('uploading', '分片上传中（0 KB/s）')

  let speedWindowStartAt = Date.now()
  let speedWindowStartBytes = progress.current()
  let smoothedSpeedBytesPerSecond = 0

  try {
    await runWithConcurrency(pendingPartNumbers, concurrency, async partNumber => {
      raiseIfAborted(input.signal)
      const start = (partNumber - 1) * session.chunkSize
      const end = Math.min(start + session.chunkSize, input.file.size)
      const blob = input.file.slice(start, end)

      const partUrl = await getMultipartPartUrlRequest(session.sessionId, partNumber)
      const uploadResult = await uploadBlobWithProgress({
        uploadUrl: partUrl.uploadUrl,
        blob,
        contentType: input.file.type || 'application/octet-stream',
        signal: input.signal,
        onProgress: loaded => {
          inFlightLoaded.set(partNumber, loaded)
          const transientBytes = Array.from(inFlightLoaded.values()).reduce((sum, size) => sum + size, 0)
          const totalUploadedBytes = Math.min(input.file.size, committedLoaded + transientBytes)
          const reportedUploadedBytes = progress.report(totalUploadedBytes)

          const now = Date.now()
          const elapsedMs = now - speedWindowStartAt
          if (elapsedMs >= 450) {
            const deltaBytes = Math.max(0, reportedUploadedBytes - speedWindowStartBytes)
            const instantSpeed = (deltaBytes * 1000) / Math.max(1, elapsedMs)
            smoothedSpeedBytesPerSecond =
              smoothedSpeedBytesPerSecond <= 0 ? instantSpeed : smoothedSpeedBytesPerSecond * 0.7 + instantSpeed * 0.3

            speedWindowStartAt = now
            speedWindowStartBytes = reportedUploadedBytes
            input.onStageChange?.('uploading', `分片上传中（${formatUploadSpeed(smoothedSpeedBytesPerSecond)}）`)
          }
        }
      })

      await reportMultipartPartCompletedRequest({
        sessionId: session.sessionId,
        partNumber,
        size: blob.size,
        eTag: uploadResult.eTag
      })

      committedLoaded += blob.size
      inFlightLoaded.delete(partNumber)
      progress.report(committedLoaded)
    })

    raiseIfAborted(input.signal)
    input.onStageChange?.('finalizing', '合并分片并完成上传...')
    const complete = await completeMultipartUploadRequest(session.sessionId)
    progress.force(input.file.size)
    input.onStageChange?.('done', '上传完成')
    clearResumeSessionId(input.fileHash, input.file.size)

    return {
      file: complete.file,
      strategy: 'multipart',
      instantUpload: false
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }

    throw error
  }
}

export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  if (!input.file) {
    throw new Error('No file selected')
  }

  raiseIfAborted(input.signal)
  input.onStageChange?.('hashing', '文件校验中 0%')
  const fileHash = await hashFileSHA256(
    input.file,
    (loaded, total) => {
      const percent = (loaded / Math.max(1, total)) * 100
      input.onStageChange?.('hashing', `文件校验中 ${percent.toFixed(1)}%`)
    },
    input.signal
  )
  raiseIfAborted(input.signal)

  input.onStageChange?.('checking', '检查是否可秒传...')
  const instantCheck = await instantCheckRequest({
    fileHash
  })

  if (instantCheck.instantUpload && instantCheck.file) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', '秒传命中，复用已有对象')
    return {
      file: instantCheck.file,
      strategy: 'instant',
      instantUpload: true
    }
  }

  const multipartThreshold = input.multipartThreshold ?? DEFAULT_MULTIPART_THRESHOLD
  if (input.file.size < multipartThreshold) {
    return uploadSingleFile({
      ...input,
      fileHash
    })
  }

  return uploadMultipartFile({
    ...input,
    fileHash
  })
}
