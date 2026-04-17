import {
  completeMultipartUploadRequest,
  completeSingleUploadRequest,
  getMultipartPartUrlRequest,
  initMultipartUploadRequest,
  initSingleUploadRequest,
  instantCheckRequest,
  reportMultipartPartCompletedRequest
} from '@/lib/upload/client/api'
import { hashFileSampleSHA256, hashFileSHA256 } from '@/lib/upload/client/hash'
import { clearResumeSessionId, getResumeSessionId, setResumeSessionId } from '@/lib/upload/client/resume-storage'
import { uploadBlobWithProgress } from '@/lib/upload/client/transport'
import {
  DEFAULT_MULTIPART_CHUNK_SIZE,
  DEFAULT_MULTIPART_THRESHOLD,
  SAMPLE_HASH_THRESHOLD,
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

interface UploadHashContext {
  fileSampleHash: string
  fileHash?: string
  fullHashPromise?: Promise<string>
  getFullHashProgress?: () => number
  resumeFingerprint: string
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

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
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

function formatBackgroundHashProgress(hashContext: UploadHashContext) {
  if (!hashContext.getFullHashProgress) {
    return null
  }

  return `${clampPercent(hashContext.getFullHashProgress()).toFixed(1)}%`
}

function buildUploadingMessage(speedText: string, hashContext: UploadHashContext) {
  const hashProgressText = formatBackgroundHashProgress(hashContext)
  if (!hashProgressText) {
    return `分片上传中（${speedText}）`
  }

  return `分片上传中（${speedText}，校验 ${hashProgressText}）`
}

async function resolveFullHash(input: UploadFileInput, hashContext: UploadHashContext) {
  if (hashContext.fileHash) {
    return hashContext.fileHash
  }

  if (!hashContext.fullHashPromise) {
    throw new Error('Missing full file hash')
  }

  const getProgress = hashContext.getFullHashProgress
  let interval: ReturnType<typeof setInterval> | null = null
  let lastReportedPercent = -1

  const reportProgress = (force = false) => {
    const percent = clampPercent(getProgress?.() ?? 0)
    if (!force && Math.abs(percent - lastReportedPercent) < 0.1) {
      return
    }

    lastReportedPercent = percent
    input.onStageChange?.('finalizing', `文件上传完成，正在完成全量校验 ${percent.toFixed(1)}%`)
  }

  if (getProgress) {
    reportProgress(true)
    interval = setInterval(() => {
      reportProgress()
    }, 320)
  } else {
    input.onStageChange?.('finalizing', '文件上传完成，正在完成全量校验')
  }

  try {
    const fileHash = await hashContext.fullHashPromise
    hashContext.fileHash = fileHash
    if (getProgress) {
      input.onStageChange?.('finalizing', '文件上传完成，正在完成全量校验 100.0%')
    }
    return fileHash
  } finally {
    if (interval) {
      clearInterval(interval)
    }
  }
}

function clearResumeSessionKeys(hashContext: UploadHashContext, fileSize: number) {
  clearResumeSessionId(hashContext.fileSampleHash, fileSize)
  clearResumeSessionId(hashContext.resumeFingerprint, fileSize)
  if (hashContext.fileHash) {
    clearResumeSessionId(hashContext.fileHash, fileSize)
  }
}

async function uploadSingleFile(
  input: UploadFileInput & { hashContext: UploadHashContext }
): Promise<UploadFileResult> {
  input.onStageChange?.('checking', '准备单文件上传...')
  const singleInit = await initSingleUploadRequest({
    fileName: input.file.name,
    contentType: input.file.type || 'application/octet-stream',
    fileSize: input.file.size,
    fileSampleHash: input.hashContext.fileSampleHash,
    fileHash: input.hashContext.fileHash
  })

  if (singleInit.instantUpload && singleInit.file) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', '秒传命中，已复用已有文件')
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
  const fileHash = await resolveFullHash(input, input.hashContext)

  input.onStageChange?.('finalizing', '提交文件元数据...')
  const complete = await completeSingleUploadRequest({
    sessionId: singleInit.session.sessionId,
    fileHash
  })

  progress.force(input.file.size)
  input.onStageChange?.('done', '上传完成')
  return {
    file: complete.file,
    strategy: 'single',
    instantUpload: false
  }
}

async function uploadMultipartFile(
  input: UploadFileInput & { hashContext: UploadHashContext }
): Promise<UploadFileResult> {
  const chunkSize = Math.max(input.chunkSize ?? DEFAULT_MULTIPART_CHUNK_SIZE, 5 * 1024 * 1024)
  const baseConcurrency = Math.max(1, Math.min(input.multipartConcurrency ?? 3, 6))
  // 当后台全量校验同时进行时，适当降低并发，减少本地磁盘抢读导致的校验拖尾。
  const concurrency =
    input.hashContext.fullHashPromise && !input.hashContext.fileHash
      ? Math.max(1, Math.min(baseConcurrency, 2))
      : baseConcurrency
  const resumeSessionId = getResumeSessionId(input.hashContext.resumeFingerprint, input.file.size) ?? undefined

  input.onStageChange?.('checking', resumeSessionId ? '检测到历史任务，准备断点续传...' : '创建分片上传会话...')
  const init = await initMultipartUploadRequest({
    fileName: input.file.name,
    contentType: input.file.type || 'application/octet-stream',
    fileSize: input.file.size,
    fileSampleHash: input.hashContext.fileSampleHash,
    fileHash: input.hashContext.fileHash,
    chunkSize,
    resumeSessionId
  })

  if (init.instantUpload && init.file) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', '秒传命中，已复用已有文件')
    clearResumeSessionKeys(input.hashContext, input.file.size)
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

  setResumeSessionId(input.hashContext.resumeFingerprint, input.file.size, session.sessionId)

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
  input.onStageChange?.('uploading', buildUploadingMessage('0 KB/s', input.hashContext))

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
            input.onStageChange?.(
              'uploading',
              buildUploadingMessage(formatUploadSpeed(smoothedSpeedBytesPerSecond), input.hashContext)
            )
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
    const fileHash = await resolveFullHash(input, input.hashContext)

    input.onStageChange?.('finalizing', '合并分片并完成上传...')
    const complete = await completeMultipartUploadRequest({
      sessionId: session.sessionId,
      fileHash
    })
    progress.force(input.file.size)
    input.onStageChange?.('done', '上传完成')
    clearResumeSessionKeys(input.hashContext, input.file.size)

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

async function uploadBySize(input: UploadFileInput, hashContext: UploadHashContext) {
  const multipartThreshold = input.multipartThreshold ?? DEFAULT_MULTIPART_THRESHOLD
  if (input.file.size < multipartThreshold) {
    return uploadSingleFile({
      ...input,
      hashContext
    })
  }

  return uploadMultipartFile({
    ...input,
    hashContext
  })
}

async function computeFullHashWithProgress(input: UploadFileInput, stagePrefix: string) {
  input.onStageChange?.('hashing', `${stagePrefix} 0%`)
  return hashFileSHA256(
    input.file,
    (loaded, total) => {
      const percent = (loaded / Math.max(1, total)) * 100
      input.onStageChange?.('hashing', `${stagePrefix} ${percent.toFixed(1)}%`)
    },
    input.signal
  )
}

async function computeSampleHashWithProgress(input: UploadFileInput) {
  input.onStageChange?.('hashing', '快速指纹计算中 0%')
  return hashFileSampleSHA256(
    input.file,
    (loaded, total) => {
      const percent = (loaded / Math.max(1, total)) * 100
      input.onStageChange?.('hashing', `快速指纹计算中 ${percent.toFixed(1)}%`)
    },
    input.signal
  )
}

export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  if (!input.file) {
    throw new Error('No file selected')
  }

  raiseIfAborted(input.signal)

  // 小文件直接走全量 hash，避免策略复杂化。
  if (input.file.size < SAMPLE_HASH_THRESHOLD) {
    const fileHash = await computeFullHashWithProgress(input, '文件校验中')
    raiseIfAborted(input.signal)

    input.onStageChange?.('checking', '检查是否可秒传...')
    const instantCheck = await instantCheckRequest({
      fileHash
    })

    if (instantCheck.instantUpload && instantCheck.file) {
      emitProgress(input, input.file.size, input.file.size)
      input.onStageChange?.('done', '秒传命中，已复用已有文件')
      return {
        file: instantCheck.file,
        strategy: 'instant',
        instantUpload: true
      }
    }

    return uploadBySize(input, {
      fileSampleHash: fileHash,
      fileHash,
      resumeFingerprint: fileHash
    })
  }

  // 大文件先做抽样指纹，再决定是否需要全量 hash。
  const fileSampleHash = await computeSampleHashWithProgress(input)
  raiseIfAborted(input.signal)

  input.onStageChange?.('checking', '快速预检中...')
  const sampleCheck = await instantCheckRequest({
    fileSampleHash,
    fileSize: input.file.size
  })

  if (sampleCheck.instantUpload && sampleCheck.file) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', '秒传命中，已复用已有文件')
    return {
      file: sampleCheck.file,
      strategy: 'instant',
      instantUpload: true
    }
  }

  if (sampleCheck.requiresFullHash) {
    const fileHash = await computeFullHashWithProgress(input, '候选命中，正在全量校验')
    raiseIfAborted(input.signal)

    input.onStageChange?.('checking', '校验秒传结果...')
    const exactCheck = await instantCheckRequest({
      fileHash
    })

    if (exactCheck.instantUpload && exactCheck.file) {
      emitProgress(input, input.file.size, input.file.size)
      input.onStageChange?.('done', '秒传命中，已复用已有文件')
      return {
        file: exactCheck.file,
        strategy: 'instant',
        instantUpload: true
      }
    }

    return uploadBySize(input, {
      fileSampleHash,
      fileHash,
      resumeFingerprint: fileHash
    })
  }

  input.onStageChange?.('checking', '快速预检未命中，开始上传并后台校验...')
  let backgroundHashProgress = 0
  const fullHashPromise = hashFileSHA256(
    input.file,
    (loaded, total) => {
      backgroundHashProgress = clampPercent((loaded / Math.max(1, total)) * 100)
    },
    input.signal
  )
  void fullHashPromise.catch(() => {
    // 失败由后续 await resolveFullHash 统一处理；此处仅避免上传中断时的未处理拒绝告警。
  })

  return uploadBySize(input, {
    fileSampleHash,
    fullHashPromise,
    getFullHashProgress: () => backgroundHashProgress,
    resumeFingerprint: fileSampleHash
  })
}
