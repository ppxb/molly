/// <reference lib="webworker" />

const STREAM_FALLBACK_CHUNK_SIZE = 8 * 1024 * 1024
const HASH_PROCESS_CHUNK_SIZE = 2 * 1024 * 1024
const PROGRESS_REPORT_INTERVAL_MS = 60

interface HashWorkerPrewarmMessage {
  type: 'prewarm'
}

interface HashWorkerStartMessage {
  type: 'start'
  requestId: string
  file: File
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

const workerScope = self as unknown as DedicatedWorkerGlobalScope
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

async function hashFileSHA256InWorker(requestId: string, file: File) {
  const hasher = await createHasher()
  const state: HashProgressState = {
    loaded: 0,
    lastReportedLoaded: 0,
    nextReportAt: nowMs() + PROGRESS_REPORT_INTERVAL_MS,
    total: file.size
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
      const hash = await hashFileSHA256InWorker(message.requestId, message.file)
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
