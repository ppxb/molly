import {
  completeMultipartUploadRequest,
  completeSingleUploadRequest,
  getMultipartPartUrlRequest,
  initMultipartUploadRequest,
  initSingleUploadRequest,
  instantCheckRequest,
  reportMultipartPartCompletedRequest,
  syncUploadedFileHashRequest
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

const PENDING_FILE_HASH_PREFIX = 'pending:'

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
  peekResolvedFullHash?: () => string | undefined
  allowDeferredCompletion?: boolean
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

function isPendingFileHash(fileHash: string) {
  return fileHash.startsWith(PENDING_FILE_HASH_PREFIX)
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

function clearResumeSessionKeys(hashContext: UploadHashContext, fileSize: number) {
  clearResumeSessionId(hashContext.fileSampleHash, fileSize)
  clearResumeSessionId(hashContext.resumeFingerprint, fileSize)
  if (hashContext.fileHash) {
    clearResumeSessionId(hashContext.fileHash, fileSize)
  }
}

function syncUploadedFileHashInBackground(file: UploadedFileRecord, hashContext: UploadHashContext) {
  if (!hashContext.fullHashPromise || !isPendingFileHash(file.fileHash)) {
    return
  }

  void hashContext.fullHashPromise
    .then(fileHash => {
      return syncUploadedFileHashRequest({
        fileId: file.id,
        fileHash
      })
    })
    .catch(() => {
      // 后台回填失败不阻塞主流程，可由后续上传再次校验触发补偿。
    })
}

async function waitFullHashWithProgress(input: UploadFileInput, hashContext: UploadHashContext) {
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

async function resolveFileHashForCompletion(input: UploadFileInput, hashContext: UploadHashContext) {
  if (hashContext.fileHash) {
    return hashContext.fileHash
  }

  const readyHash = hashContext.peekResolvedFullHash?.()
  if (readyHash) {
    hashContext.fileHash = readyHash
    return readyHash
  }

  if (!hashContext.fullHashPromise) {
    return undefined
  }

  if (hashContext.allowDeferredCompletion) {
    return undefined
  }

  return waitFullHashWithProgress(input, hashContext)
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
  const fileHash = await resolveFileHashForCompletion(input, input.hashContext)

  input.onStageChange?.('finalizing', '提交文件元数据...')
  const complete = await completeSingleUploadRequest({
    sessionId: singleInit.session.sessionId,
    fileHash
  })

  progress.force(input.file.size)
  syncUploadedFileHashInBackground(complete.file, input.hashContext)
  input.onStageChange?.(
    'done',
    isPendingFileHash(complete.file.fileHash) ? '上传完成（全量校验后台进行中）' : '上传完成'
  )

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
  // 后台全量校验和分片上传并行时，适当降低并发减少本地 IO 抢占。
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
  input.onStageChange?.('uploading', '0 KB/s')

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
            input.onStageChange?.('uploading', formatUploadSpeed(smoothedSpeedBytesPerSecond))
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
    const fileHash = await resolveFileHashForCompletion(input, input.hashContext)

    input.onStageChange?.('finalizing', '合并分片并完成上传...')
    const complete = await completeMultipartUploadRequest({
      sessionId: session.sessionId,
      fileHash
    })
    progress.force(input.file.size)
    clearResumeSessionKeys(input.hashContext, input.file.size)
    syncUploadedFileHashInBackground(complete.file, input.hashContext)
    input.onStageChange?.(
      'done',
      isPendingFileHash(complete.file.fileHash) ? '上传完成（全量校验后台进行中）' : '上传完成'
    )

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

  // 小文件直接全量 hash。
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

  // 大文件先做抽样 hash + size 预检。
  const fileSampleHash = await computeSampleHashWithProgress(input)
  raiseIfAborted(input.signal)

  input.onStageChange?.('checking', '快速预检中...')
  const sampleCheck = await instantCheckRequest({
    fileSampleHash,
    fileSize: input.file.size
  })

  if (sampleCheck.instantUpload && sampleCheck.file) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', '秒传命中')
    return {
      file: sampleCheck.file,
      strategy: 'instant',
      instantUpload: true
    }
  }

  // POSSIBLE_HIT：先全量 hash，再精确判定是否秒传。
  if (sampleCheck.requiresFullHash) {
    const fileHash = await computeFullHashWithProgress(input, '候选命中，正在全量校验')
    raiseIfAborted(input.signal)

    input.onStageChange?.('checking', '校验秒传结果...')
    const exactCheck = await instantCheckRequest({
      fileHash
    })

    if (exactCheck.instantUpload && exactCheck.file) {
      emitProgress(input, input.file.size, input.file.size)
      input.onStageChange?.('done', '秒传命中')
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

  // MISS：直接上传，不阻塞等待全量 hash。全量 hash 在后台完成后再回填。
  input.onStageChange?.('checking', '快速预检未命中，开始上传...')
  let backgroundHashProgress = 0
  let resolvedBackgroundHash: string | undefined

  const fullHashPromise = hashFileSHA256(
    input.file,
    (loaded, total) => {
      backgroundHashProgress = clampPercent((loaded / Math.max(1, total)) * 100)
    },
    input.signal
  ).then(fileHash => {
    resolvedBackgroundHash = fileHash
    return fileHash
  })

  void fullHashPromise.catch(() => {
    // 后台校验失败不影响主上传完成。
  })

  return uploadBySize(input, {
    fileSampleHash,
    fullHashPromise,
    getFullHashProgress: () => backgroundHashProgress,
    peekResolvedFullHash: () => resolvedBackgroundHash,
    allowDeferredCompletion: true,
    resumeFingerprint: fileSampleHash
  })
}
