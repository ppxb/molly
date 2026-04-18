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
  folderId?: string
  folderPath?: string
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

function createAbortError() {
  return new DOMException('Upload aborted', 'AbortError')
}

function raiseIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError()
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

function resolveTargetFolderId(input: UploadFileInput) {
  return input.folderId?.trim() || 'root'
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

function clearResumeSessionKeys(hashContext: UploadHashContext, fileSize: number, folderId: string) {
  clearResumeSessionId(hashContext.fileSampleHash, fileSize, folderId)
  clearResumeSessionId(hashContext.resumeFingerprint, fileSize, folderId)
  if (hashContext.fileHash) {
    clearResumeSessionId(hashContext.fileHash, fileSize, folderId)
  }
}

function syncUploadedFileHashInBackground(file: UploadedFileRecord, hashContext: UploadHashContext) {
  if (!hashContext.fullHashPromise || !isPendingFileHash(file.fileHash)) {
    return
  }

  void hashContext.fullHashPromise
    .then(fileHash =>
      syncUploadedFileHashRequest({
        fileId: file.id,
        fileHash
      })
    )
    .catch(() => {
      // Non-blocking best-effort sync.
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
    input.onStageChange?.('finalizing', `Upload complete, finalizing full hash ${percent.toFixed(1)}%`)
  }

  if (getProgress) {
    reportProgress(true)
    interval = setInterval(() => {
      reportProgress()
    }, 320)
  } else {
    input.onStageChange?.('finalizing', 'Upload complete, finalizing full hash')
  }

  try {
    const fileHash = await hashContext.fullHashPromise
    hashContext.fileHash = fileHash
    if (getProgress) {
      input.onStageChange?.('finalizing', 'Upload complete, finalizing full hash 100.0%')
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
  const folderId = resolveTargetFolderId(input)
  input.onStageChange?.('checking', 'Preparing single-file upload...')
  const singleInit = await initSingleUploadRequest({
    fileName: input.file.name,
    folderId,
    contentType: input.file.type || 'application/octet-stream',
    fileSize: input.file.size,
    fileSampleHash: input.hashContext.fileSampleHash,
    fileHash: input.hashContext.fileHash
  })

  if (singleInit.instantUpload && singleInit.file) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', 'Instant upload hit, reusing existing file')
    return {
      file: singleInit.file,
      strategy: 'instant',
      instantUpload: true
    }
  }

  if (!singleInit.session) {
    throw new Error('Missing single-upload session')
  }

  input.onStageChange?.('uploading', 'Uploading file...')
  const progress = createMonotonicProgressReporter(input, input.file.size, 0)
  const uploadResult = await uploadBlobWithProgress({
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

  input.onStageChange?.('finalizing', 'Submitting file metadata...')
  const complete = await completeSingleUploadRequest({
    sessionId: singleInit.session.sessionId,
    fileHash,
    eTag: uploadResult.eTag,
    size: input.file.size
  })

  progress.force(input.file.size)
  syncUploadedFileHashInBackground(complete.file, input.hashContext)
  input.onStageChange?.(
    'done',
    isPendingFileHash(complete.file.fileHash)
      ? 'Upload completed (full hash syncing in background)'
      : 'Upload completed'
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
  const folderId = resolveTargetFolderId(input)
  const chunkSize = Math.max(input.chunkSize ?? DEFAULT_MULTIPART_CHUNK_SIZE, 5 * 1024 * 1024)
  const baseConcurrency = Math.max(1, Math.min(input.multipartConcurrency ?? 3, 6))
  const concurrency =
    input.hashContext.fullHashPromise && !input.hashContext.fileHash
      ? Math.max(1, Math.min(baseConcurrency, 2))
      : baseConcurrency

  const resumeSessionId =
    getResumeSessionId(input.hashContext.resumeFingerprint, input.file.size, folderId) ?? undefined

  input.onStageChange?.('checking', resumeSessionId ? 'Preparing resume upload' : 'Creating multipart upload')
  const init = await initMultipartUploadRequest({
    fileName: input.file.name,
    folderId,
    contentType: input.file.type || 'application/octet-stream',
    fileSize: input.file.size,
    fileSampleHash: input.hashContext.fileSampleHash,
    fileHash: input.hashContext.fileHash,
    chunkSize,
    resumeSessionId
  })

  if (init.instantUpload && init.file) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', 'Instant upload hit, reusing existing file')
    clearResumeSessionKeys(input.hashContext, input.file.size, folderId)
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

  setResumeSessionId(input.hashContext.resumeFingerprint, input.file.size, session.sessionId, folderId)

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

  input.onStageChange?.('finalizing', 'Merging parts and finalizing upload...')
  const complete = await completeMultipartUploadRequest({
    sessionId: session.sessionId,
    fileHash
  })
  progress.force(input.file.size)
  clearResumeSessionKeys(input.hashContext, input.file.size, folderId)
  syncUploadedFileHashInBackground(complete.file, input.hashContext)
  input.onStageChange?.(
    'done',
    isPendingFileHash(complete.file.fileHash)
      ? 'Upload completed (full hash syncing in background)'
      : 'Upload completed'
  )

  return {
    file: complete.file,
    strategy: 'multipart',
    instantUpload: false
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
  input.onStageChange?.('hashing', 'Starting sample hash')
  return hashFileSampleSHA256(
    input.file,
    (loaded, total) => {
      const percent = (loaded / Math.max(1, total)) * 100
      input.onStageChange?.('hashing', `Sample hash ${percent.toFixed(1)}%`)
    },
    input.signal
  )
}

export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  if (!input.file) {
    throw new Error('No file selected')
  }

  const folderId = resolveTargetFolderId(input)
  raiseIfAborted(input.signal)

  if (input.file.size < SAMPLE_HASH_THRESHOLD) {
    const fileHash = await computeFullHashWithProgress(input, 'Verifying file')
    raiseIfAborted(input.signal)

    input.onStageChange?.('checking', 'Checking instant upload eligibility...')
    const instantCheck = await instantCheckRequest({
      fileHash,
      fileName: input.file.name,
      contentType: input.file.type || 'application/octet-stream',
      fileSize: input.file.size,
      folderId
    })

    if (instantCheck.instantUpload && instantCheck.file) {
      emitProgress(input, input.file.size, input.file.size)
      input.onStageChange?.('done', 'Instant upload hit, reusing existing file')
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

  const fileSampleHash = await computeSampleHashWithProgress(input)
  raiseIfAborted(input.signal)

  input.onStageChange?.('checking', 'Quick pre-check')
  const sampleCheck = await instantCheckRequest({
    fileSampleHash,
    fileSize: input.file.size,
    fileName: input.file.name,
    contentType: input.file.type || 'application/octet-stream',
    folderId
  })

  if (sampleCheck.instantUpload && sampleCheck.file) {
    emitProgress(input, input.file.size, input.file.size)
    input.onStageChange?.('done', 'Instant upload hit')
    return {
      file: sampleCheck.file,
      strategy: 'instant',
      instantUpload: true
    }
  }

  if (sampleCheck.requiresFullHash) {
    const fileHash = await computeFullHashWithProgress(input, 'Candidate matched, running full verification')
    raiseIfAborted(input.signal)

    input.onStageChange?.('checking', 'Verifying instant upload result...')
    const exactCheck = await instantCheckRequest({
      fileHash,
      fileName: input.file.name,
      contentType: input.file.type || 'application/octet-stream',
      fileSize: input.file.size,
      folderId
    })

    if (exactCheck.instantUpload && exactCheck.file) {
      emitProgress(input, input.file.size, input.file.size)
      input.onStageChange?.('done', 'Instant upload hit')
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

  input.onStageChange?.('checking', 'Quick pre-check missed, starting upload')
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
    // Non-blocking best-effort hashing.
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
