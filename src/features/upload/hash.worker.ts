/// <reference lib="webworker" />

import {
  SAMPLE_HASH_HEAD_SIZE,
  SAMPLE_HASH_MIDDLE_PART_COUNT,
  SAMPLE_HASH_MIDDLE_PART_SIZE,
  SAMPLE_HASH_TAIL_SIZE,
  SAMPLE_HASH_VERSION
} from '@/features/upload/config'

const STREAM_FALLBACK_CHUNK = 8 * 1024 * 1024
const HASH_PROCESS_CHUNK = 4 * 1024 * 1024
const PROGRESS_INTERVAL_MS = 120

interface HashSamplingConfig {
  headSize: number
  tailSize: number
  middlePartCount: number
  middlePartSize: number
  version: string
}

type IncomingMessage =
  | { type: 'prewarm' }
  | { type: 'start'; requestId: string; file: File; mode?: 'full' | 'sample'; sampling?: HashSamplingConfig }

interface SHA256Hasher {
  init: () => void
  update: (data: Uint8Array | ArrayBuffer) => void
  digest: () => string
}

interface ProgressState {
  loaded: number
  lastReported: number
  nextReportAt: number
  total: number
}

interface ByteRange {
  start: number
  end: number
}

const scope = self as unknown as DedicatedWorkerGlobalScope
const encoder = new TextEncoder()
let wasmPromise: Promise<{ createSHA256: () => Promise<SHA256Hasher> }> | null = null

function now() {
  return performance.now()
}

async function loadWasm() {
  if (!wasmPromise) wasmPromise = import('hash-wasm') as unknown as typeof wasmPromise
  return wasmPromise!
}

async function createHasher(): Promise<SHA256Hasher> {
  const wasm = await loadWasm()
  const h = await wasm.createSHA256()
  h.init()
  return h
}

function reportProgress(requestId: string, state: ProgressState, force = false) {
  const t = now()
  if (!force && (state.loaded === state.lastReported || t < state.nextReportAt)) return
  scope.postMessage({ type: 'progress', requestId, loaded: Math.min(state.total, state.loaded), total: state.total })
  state.lastReported = state.loaded
  state.nextReportAt = t + PROGRESS_INTERVAL_MS
}

function hashChunk(requestId: string, hasher: SHA256Hasher, chunk: Uint8Array, state: ProgressState) {
  let offset = 0
  while (offset < chunk.byteLength) {
    const end = Math.min(offset + HASH_PROCESS_CHUNK, chunk.byteLength)
    const piece = chunk.subarray(offset, end)
    hasher.update(piece)
    state.loaded += piece.byteLength
    reportProgress(requestId, state)
    offset = end
  }
}

async function hashFull(requestId: string, file: File): Promise<string> {
  const hasher = await createHasher()
  const state: ProgressState = {
    loaded: 0,
    lastReported: 0,
    nextReportAt: now() + PROGRESS_INTERVAL_MS,
    total: Math.max(1, file.size)
  }

  if (typeof file.stream === 'function') {
    const reader = file.stream().getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value?.byteLength) hashChunk(requestId, hasher, value, state)
      }
    } finally {
      reader.releaseLock()
    }
  } else {
    for (let start = 0; start < file.size; start += STREAM_FALLBACK_CHUNK) {
      const buf = await file.slice(start, Math.min(start + STREAM_FALLBACK_CHUNK, file.size)).arrayBuffer()
      hashChunk(requestId, hasher, new Uint8Array(buf), state)
    }
  }

  reportProgress(requestId, state, true)
  return hasher.digest()
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function buildRanges(size: number, cfg: HashSamplingConfig): ByteRange[] {
  const ranges: ByteRange[] = []
  const headEnd = Math.min(size, Math.max(0, cfg.headSize))
  if (headEnd > 0) ranges.push({ start: 0, end: headEnd })
  const tailStart = Math.max(0, size - Math.max(0, cfg.tailSize))
  if (tailStart < size) ranges.push({ start: tailStart, end: size })

  const mStart = headEnd,
    mEnd = Math.max(mStart, tailStart)
  const avail = mEnd - mStart
  const pCount = Math.max(0, cfg.middlePartCount)
  const pSize = Math.max(0, Math.min(cfg.middlePartSize, avail))

  if (avail > 0 && pCount > 0 && pSize > 0) {
    const step = avail / (pCount + 1)
    for (let i = 1; i <= pCount; i++) {
      const center = mStart + step * i
      const start = clamp(Math.floor(center - pSize / 2), mStart, mEnd - pSize)
      ranges.push({ start, end: start + pSize })
    }
  }

  // 合并重叠区间
  return ranges
    .filter(r => r.end > r.start)
    .sort((a, b) => a.start - b.start)
    .reduce<ByteRange[]>((acc, r) => {
      const last = acc[acc.length - 1]
      if (last && r.start <= last.end) {
        last.end = Math.max(last.end, r.end)
      } else acc.push({ ...r })
      return acc
    }, [])
}

function defaultSampling(): HashSamplingConfig {
  return {
    headSize: SAMPLE_HASH_HEAD_SIZE,
    tailSize: SAMPLE_HASH_TAIL_SIZE,
    middlePartCount: SAMPLE_HASH_MIDDLE_PART_COUNT,
    middlePartSize: SAMPLE_HASH_MIDDLE_PART_SIZE,
    version: SAMPLE_HASH_VERSION
  }
}

async function hashSample(requestId: string, file: File, sampling?: HashSamplingConfig): Promise<string> {
  const hasher = await createHasher()
  const cfg = sampling ?? defaultSampling()
  const ranges = buildRanges(file.size, cfg)
  const total = ranges.reduce((s, r) => s + r.end - r.start, 0)
  const state: ProgressState = {
    loaded: 0,
    lastReported: 0,
    nextReportAt: now() + PROGRESS_INTERVAL_MS,
    total: Math.max(1, total)
  }

  hasher.update(encoder.encode(`${cfg.version}|${file.size}|${ranges.length}|`))
  for (const r of ranges) {
    const len = r.end - r.start
    hasher.update(encoder.encode(`${r.start}:${len}|`))
    const buf = await file.slice(r.start, r.end).arrayBuffer()
    hashChunk(requestId, hasher, new Uint8Array(buf), state)
  }

  reportProgress(requestId, state, true)
  return hasher.digest()
}

scope.onmessage = event => {
  const msg = event.data as IncomingMessage | undefined
  if (!msg) return

  if (msg.type === 'prewarm') {
    void createHasher()
      .then(() => scope.postMessage({ type: 'prewarm-ready' }))
      .catch(err => scope.postMessage({ type: 'prewarm-error', error: String(err) }))
    return
  }

  void (async () => {
    try {
      const hash =
        msg.mode === 'sample'
          ? await hashSample(msg.requestId, msg.file, msg.sampling)
          : await hashFull(msg.requestId, msg.file)
      scope.postMessage({ type: 'done', requestId: msg.requestId, hash })
    } catch (err) {
      scope.postMessage({ type: 'error', requestId: msg.requestId, error: String(err) })
    }
  })()
}

export {}
