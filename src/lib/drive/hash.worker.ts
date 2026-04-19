/// <reference lib="webworker" />

import {
  SAMPLE_HASH_HEAD_SIZE,
  SAMPLE_HASH_MIDDLE_PART_COUNT,
  SAMPLE_HASH_MIDDLE_PART_SIZE,
  SAMPLE_HASH_TAIL_SIZE,
  SAMPLE_HASH_VERSION
} from '@/lib/drive/types'

const STREAM_FALLBACK_CHUNK_SIZE = 8 * 1024 * 1024
const HASH_PROCESS_CHUNK_SIZE = 4 * 1024 * 1024
const PROGRESS_REPORT_INTERVAL_MS = 120

interface HashWorkerPrewarmMessage {
  type: 'prewarm'
}

interface HashSamplingConfig {
  headSize: number
  tailSize: number
  middlePartCount: number
  middlePartSize: number
  version: string
}

interface HashWorkerStartMessage {
  type: 'start'
  requestId: string
  file: File
  mode?: 'full' | 'sample'
  sampling?: HashSamplingConfig
}

interface HashWorkerMessageBase {
  requestId: string
}

interface HashWorkerProgressMessage extends HashWorkerMessageBase {
  type: 'progress'
  loaded: number
  total: number
}

interface HashWorkerDoneMessage extends HashWorkerMessageBase {
  type: 'done'
  hash: string
}

interface HashWorkerErrorMessage extends HashWorkerMessageBase {
  type: 'error'
  error: string
}

interface HashWorkerPrewarmReadyMessage {
  type: 'prewarm-ready'
}

interface HashWorkerPrewarmErrorMessage {
  type: 'prewarm-error'
  error: string
}

type IncomingMessage = HashWorkerPrewarmMessage | HashWorkerStartMessage

type SHA256Hasher = {
  init: () => void
  update: (data: Uint8Array | ArrayBuffer) => void
  digest: () => string
}

interface HashWasmModule {
  createSHA256: () => Promise<SHA256Hasher>
}

interface HashProgressState {
  loaded: number
  lastReportedLoaded: number
  nextReportAt: number
  total: number
}

interface ByteRange {
  start: number
  end: number
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope
const textEncoder = new TextEncoder()
let hashWasmModulePromise: Promise<HashWasmModule> | null = null

function nowMs() {
  return performance.now()
}

async function loadHashWasmModule() {
  if (!hashWasmModulePromise) {
    hashWasmModulePromise = import('hash-wasm') as Promise<HashWasmModule>
  }
  return hashWasmModulePromise
}

async function createHasher() {
  const hashWasm = await loadHashWasmModule()
  const hasher = await hashWasm.createSHA256()
  hasher.init()
  return hasher
}

function maybeReportProgress(requestId: string, state: HashProgressState, force = false) {
  const now = nowMs()
  if (!force) {
    if (state.loaded === state.lastReportedLoaded) {
      return
    }
    if (now < state.nextReportAt) {
      return
    }
  }

  const message: HashWorkerProgressMessage = {
    type: 'progress',
    requestId,
    loaded: Math.min(state.total, state.loaded),
    total: state.total
  }
  workerScope.postMessage(message)
  state.lastReportedLoaded = state.loaded
  state.nextReportAt = now + PROGRESS_REPORT_INTERVAL_MS
}

function hashChunkIncrementally(requestId: string, hasher: SHA256Hasher, chunk: Uint8Array, state: HashProgressState) {
  let offset = 0
  while (offset < chunk.byteLength) {
    const end = Math.min(offset + HASH_PROCESS_CHUNK_SIZE, chunk.byteLength)
    const piece = chunk.subarray(offset, end)
    hasher.update(piece)
    state.loaded += piece.byteLength
    maybeReportProgress(requestId, state)
    offset = end
  }
}

async function hashBySlice(requestId: string, file: File, hasher: SHA256Hasher, state: HashProgressState) {
  for (let start = 0; start < file.size; start += STREAM_FALLBACK_CHUNK_SIZE) {
    const end = Math.min(start + STREAM_FALLBACK_CHUNK_SIZE, file.size)
    const buffer = await file.slice(start, end).arrayBuffer()
    hashChunkIncrementally(requestId, hasher, new Uint8Array(buffer), state)
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeRanges(ranges: ByteRange[]) {
  const sorted = ranges
    .filter(range => range.end > range.start)
    .sort((a, b) => {
      if (a.start === b.start) {
        return a.end - b.end
      }
      return a.start - b.start
    })

  if (sorted.length <= 1) {
    return sorted
  }

  const merged: ByteRange[] = []
  let current = sorted[0]

  for (let index = 1; index < sorted.length; index += 1) {
    const next = sorted[index]
    if (next.start <= current.end) {
      current = {
        start: current.start,
        end: Math.max(current.end, next.end)
      }
      continue
    }

    merged.push(current)
    current = next
  }

  merged.push(current)
  return merged
}

function buildSamplingRanges(fileSize: number, sampling: HashSamplingConfig) {
  const ranges: ByteRange[] = []
  const headEnd = Math.min(fileSize, Math.max(0, sampling.headSize))
  if (headEnd > 0) {
    ranges.push({
      start: 0,
      end: headEnd
    })
  }

  const tailStart = Math.max(0, fileSize - Math.max(0, sampling.tailSize))
  if (tailStart < fileSize) {
    ranges.push({
      start: tailStart,
      end: fileSize
    })
  }

  const middleStart = headEnd
  const middleEnd = Math.max(middleStart, tailStart)
  const availableMiddle = middleEnd - middleStart
  const middlePartCount = Math.max(0, sampling.middlePartCount)
  const middlePartSize = Math.max(0, Math.min(sampling.middlePartSize, availableMiddle))

  if (availableMiddle > 0 && middlePartCount > 0 && middlePartSize > 0) {
    const step = availableMiddle / (middlePartCount + 1)
    for (let i = 1; i <= middlePartCount; i += 1) {
      const center = middleStart + step * i
      const start = clamp(Math.floor(center - middlePartSize / 2), middleStart, middleEnd - middlePartSize)
      ranges.push({
        start,
        end: start + middlePartSize
      })
    }
  }

  return normalizeRanges(ranges)
}

function getDefaultSamplingConfig(): HashSamplingConfig {
  return {
    headSize: SAMPLE_HASH_HEAD_SIZE,
    tailSize: SAMPLE_HASH_TAIL_SIZE,
    middlePartCount: SAMPLE_HASH_MIDDLE_PART_COUNT,
    middlePartSize: SAMPLE_HASH_MIDDLE_PART_SIZE,
    version: SAMPLE_HASH_VERSION
  }
}

async function hashFileSHA256InWorker(requestId: string, file: File) {
  const hasher = await createHasher()
  const state: HashProgressState = {
    loaded: 0,
    lastReportedLoaded: 0,
    nextReportAt: nowMs() + PROGRESS_REPORT_INTERVAL_MS,
    total: Math.max(1, file.size)
  }

  if (typeof file.stream === 'function') {
    const reader = file.stream().getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        if (!value || value.byteLength === 0) {
          continue
        }

        hashChunkIncrementally(requestId, hasher, value, state)
      }
    } finally {
      reader.releaseLock()
    }
  } else {
    await hashBySlice(requestId, file, hasher, state)
  }

  maybeReportProgress(requestId, state, true)
  return hasher.digest()
}

async function hashFileSampleSHA256InWorker(requestId: string, file: File, sampling?: HashSamplingConfig) {
  const hasher = await createHasher()
  const resolvedSampling = sampling ?? getDefaultSamplingConfig()
  const ranges = buildSamplingRanges(file.size, resolvedSampling)
  const totalSampleBytes = ranges.reduce((sum, range) => sum + (range.end - range.start), 0)
  const state: HashProgressState = {
    loaded: 0,
    lastReportedLoaded: 0,
    nextReportAt: nowMs() + PROGRESS_REPORT_INTERVAL_MS,
    total: Math.max(1, totalSampleBytes)
  }

  // Include algorithm version, file size, and sampling layout in the hash input to avoid collisions across configs.
  hasher.update(textEncoder.encode(`${resolvedSampling.version}|${file.size}|${ranges.length}|`))

  for (const range of ranges) {
    const length = range.end - range.start
    hasher.update(textEncoder.encode(`${range.start}:${length}|`))

    const buffer = await file.slice(range.start, range.end).arrayBuffer()
    hashChunkIncrementally(requestId, hasher, new Uint8Array(buffer), state)
  }

  maybeReportProgress(requestId, state, true)
  return hasher.digest()
}

workerScope.onmessage = event => {
  const message = event.data as IncomingMessage | undefined
  if (!message) {
    return
  }

  if (message.type === 'prewarm') {
    void (async () => {
      try {
        await createHasher()
        const readyMessage: HashWorkerPrewarmReadyMessage = {
          type: 'prewarm-ready'
        }
        workerScope.postMessage(readyMessage)
      } catch (error) {
        const prewarmErrorMessage: HashWorkerPrewarmErrorMessage = {
          type: 'prewarm-error',
          error: error instanceof Error ? error.message : 'Failed to prewarm hash worker'
        }
        workerScope.postMessage(prewarmErrorMessage)
      }
    })()
    return
  }

  void (async () => {
    try {
      const mode = message.mode ?? 'full'
      const hash =
        mode === 'sample'
          ? await hashFileSampleSHA256InWorker(message.requestId, message.file, message.sampling)
          : await hashFileSHA256InWorker(message.requestId, message.file)

      const doneMessage: HashWorkerDoneMessage = {
        type: 'done',
        requestId: message.requestId,
        hash
      }
      workerScope.postMessage(doneMessage)
    } catch (error) {
      const errorMessage: HashWorkerErrorMessage = {
        type: 'error',
        requestId: message.requestId,
        error: error instanceof Error ? error.message : 'Failed to hash file in worker'
      }
      workerScope.postMessage(errorMessage)
    }
  })()
}

export {}
