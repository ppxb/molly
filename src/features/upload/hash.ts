import {
  SAMPLE_HASH_HEAD_SIZE,
  SAMPLE_HASH_MIDDLE_PART_COUNT,
  SAMPLE_HASH_MIDDLE_PART_SIZE,
  SAMPLE_HASH_TAIL_SIZE,
  SAMPLE_HASH_VERSION
} from '@/features/upload/config'

export interface HashSamplingConfig {
  headSize: number
  tailSize: number
  middlePartCount: number
  middlePartSize: number
  version: string
}

interface PrewarmMessage {
  type: 'prewarm'
}

interface StartMessage {
  type: 'start'
  requestId: string
  file: File
  mode?: 'full' | 'sample'
  sampling?: HashSamplingConfig
}

interface ProgressMessage {
  type: 'progress'
  requestId: string
  loaded: number
  total: number
}
interface DoneMessage {
  type: 'done'
  requestId: string
  hash: string
}
interface ErrorMessage {
  type: 'error'
  requestId: string
  error: string
}
interface PrewarmReady {
  type: 'prewarm-ready'
}
interface PrewarmError {
  type: 'prewarm-error'
  error: string
}

type WorkerOutMessage = ProgressMessage | DoneMessage | ErrorMessage | PrewarmReady | PrewarmError

let warmWorker: Worker | null = null
let warmWorkerReady: Promise<void> | null = null
let hasScheduledPrewarm = false
let seq = 0

function supportsWorker() {
  return typeof Worker !== 'undefined'
}
function createAbortError() {
  return new DOMException('Upload aborted', 'AbortError')
}
function nextRequestId() {
  return `hash-${Date.now()}-${++seq}`
}

function createWorker() {
  return new Worker(new URL('./hash.worker.ts', import.meta.url), { type: 'module' })
}

function prewarmWorker(worker: Worker): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
    }
    const onError = () => {
      cleanup()
      reject(new Error('Hash worker 初始化失败'))
    }
    const onMessage = (e: MessageEvent<WorkerOutMessage>) => {
      if (e.data.type === 'prewarm-ready') {
        cleanup()
        resolve()
      }
      if (e.data.type === 'prewarm-error') {
        cleanup()
        reject(new Error(e.data.error))
      }
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage({ type: 'prewarm' } satisfies PrewarmMessage)
  })
}

function ensureWarmWorker(): Promise<void> {
  if (!supportsWorker()) return Promise.resolve()
  if (!warmWorker) {
    warmWorker = createWorker()
    warmWorkerReady = null
  }
  if (!warmWorkerReady) {
    warmWorkerReady = prewarmWorker(warmWorker).catch(err => {
      warmWorker?.terminate()
      warmWorker = null
      warmWorkerReady = null
      throw err
    })
  }
  return warmWorkerReady
}

function acquireWorker(): { worker: Worker; ready: Promise<void> } {
  if (!supportsWorker()) throw new Error('当前环境不支持 Web Worker')
  if (warmWorker) {
    const worker = warmWorker
    const ready = warmWorkerReady ?? Promise.resolve()
    warmWorker = null
    warmWorkerReady = null
    return { worker, ready }
  }
  return { worker: createWorker(), ready: Promise.resolve() }
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

function runHash(
  input: { file: File; mode: 'full' | 'sample'; sampling?: HashSamplingConfig },
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted) return Promise.reject(createAbortError())

  const { worker, ready } = acquireWorker()
  const requestId = nextRequestId()

  return new Promise((resolve, reject) => {
    let settled = false

    const cleanup = (terminate: boolean) => {
      signal?.removeEventListener('abort', onAbort)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onWorkerError)
      if (terminate) worker.terminate()
    }

    const finish = (hash: string) => {
      if (settled) return
      settled = true
      cleanup(false)
      // 归还 worker
      warmWorker = worker
      warmWorkerReady = Promise.resolve()
      resolve(hash)
    }

    const fail = (err: Error | DOMException) => {
      if (settled) return
      settled = true
      cleanup(true)
      reject(err)
    }

    const onAbort = () => fail(createAbortError())
    const onWorkerError = () => fail(new Error('Hash worker 发生错误'))
    const onMessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data
      if (!msg || (msg as { requestId?: string }).requestId !== requestId) return
      if (msg.type === 'progress') {
        onProgress?.(msg.loaded, msg.total)
        return
      }
      if (msg.type === 'done') finish(msg.hash)
      if (msg.type === 'error') fail(new Error(msg.error || 'Hash 计算失败'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onWorkerError)

    ready
      .then(() => {
        if (settled) return
        worker.postMessage({
          type: 'start',
          requestId,
          file: input.file,
          mode: input.mode,
          sampling: input.sampling
        } satisfies StartMessage)
      })
      .catch(err => fail(err instanceof Error ? err : new Error(String(err))))
  })
}

export function prewarmHashWorker() {
  return ensureWarmWorker()
}

export function scheduleHashWorkerPrewarm() {
  if (!supportsWorker() || hasScheduledPrewarm) return
  hasScheduledPrewarm = true
  const run = () =>
    void prewarmHashWorker().catch(() => {
      hasScheduledPrewarm = false
    })
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 1500 })
  } else {
    setTimeout(run, 800)
  }
}

export function hashFileFull(file: File, onProgress?: (loaded: number, total: number) => void, signal?: AbortSignal) {
  return runHash({ file, mode: 'full' }, onProgress, signal)
}

export function hashFileSample(
  file: File,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
  sampling?: Partial<HashSamplingConfig>
) {
  return runHash({ file, mode: 'sample', sampling: { ...defaultSampling(), ...sampling } }, onProgress, signal)
}
