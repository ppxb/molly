interface HashWorkerPrewarmMessage {
  type: 'prewarm'
}

interface HashWorkerStartMessage {
  type: 'start'
  requestId: string
  file: File
}

interface HashWorkerProgressMessage {
  type: 'progress'
  requestId: string
  loaded: number
  total: number
}

interface HashWorkerDoneMessage {
  type: 'done'
  requestId: string
  hash: string
}

interface HashWorkerErrorMessage {
  type: 'error'
  requestId: string
  error: string
}

interface HashWorkerPrewarmReadyMessage {
  type: 'prewarm-ready'
}

interface HashWorkerPrewarmErrorMessage {
  type: 'prewarm-error'
  error: string
}

type HashWorkerMessage =
  | HashWorkerProgressMessage
  | HashWorkerDoneMessage
  | HashWorkerErrorMessage
  | HashWorkerPrewarmReadyMessage
  | HashWorkerPrewarmErrorMessage

let warmWorker: Worker | null = null
let warmWorkerPrewarmPromise: Promise<void> | null = null
let hasScheduledIdlePrewarm = false
let requestSequence = 0

function createAbortError() {
  return new DOMException('Upload aborted', 'AbortError')
}

function supportsWorker() {
  return typeof Worker !== 'undefined'
}

function createHashWorker() {
  return new Worker(new URL('./hash.worker.ts', import.meta.url), {
    type: 'module'
  })
}

function createRequestId() {
  requestSequence += 1
  return `hash-${Date.now()}-${requestSequence}`
}

function toError(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error : new Error(fallbackMessage)
}

async function prewarmWorker(worker: Worker) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleError)
    }

    const handleError = () => {
      cleanup()
      reject(new Error('Failed to initialize hash worker'))
    }

    const handleMessage = (event: MessageEvent<HashWorkerMessage>) => {
      const message = event.data
      if (!message) {
        return
      }

      if (message.type === 'prewarm-ready') {
        cleanup()
        resolve()
        return
      }

      if (message.type === 'prewarm-error') {
        cleanup()
        reject(new Error(message.error || 'Failed to prewarm hash worker'))
      }
    }

    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleError)

    const warmupMessage: HashWorkerPrewarmMessage = {
      type: 'prewarm'
    }
    worker.postMessage(warmupMessage)
  })
}

function warmWorkerIfNeeded() {
  if (!supportsWorker()) {
    return Promise.resolve()
  }

  if (!warmWorker) {
    warmWorker = createHashWorker()
    warmWorkerPrewarmPromise = null
  }

  if (!warmWorkerPrewarmPromise) {
    warmWorkerPrewarmPromise = prewarmWorker(warmWorker).catch(error => {
      warmWorker?.terminate()
      warmWorker = null
      warmWorkerPrewarmPromise = null
      throw error
    })
  }

  return warmWorkerPrewarmPromise
}

function acquireWorkerForHash() {
  if (!supportsWorker()) {
    throw new Error('Web Worker is not supported in this environment')
  }

  if (warmWorker) {
    const acquiredWorker = warmWorker
    const prewarmed = warmWorkerPrewarmPromise ?? Promise.resolve()
    warmWorker = null
    warmWorkerPrewarmPromise = null
    return {
      worker: acquiredWorker,
      ready: prewarmed
    }
  }

  return {
    worker: createHashWorker(),
    ready: Promise.resolve()
  }
}

export function prewarmHashWorker() {
  return warmWorkerIfNeeded()
}

export function scheduleHashWorkerPrewarm() {
  if (!supportsWorker() || hasScheduledIdlePrewarm) {
    return
  }

  hasScheduledIdlePrewarm = true

  const runPrewarm = () => {
    void prewarmHashWorker().catch(() => {
      hasScheduledIdlePrewarm = false
    })
  }

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(
      () => {
        runPrewarm()
      },
      {
        timeout: 1500
      }
    )
    return
  }

  setTimeout(runPrewarm, 800)
}

export function hashFileSHA256(file: File, onProgress?: (loaded: number, total: number) => void, signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError()
  }

  const { worker, ready } = acquireWorkerForHash()
  const requestId = createRequestId()

  return new Promise<string>((resolve, reject) => {
    let settled = false

    const cleanup = (terminateWorker: boolean) => {
      if (signal) {
        signal.removeEventListener('abort', handleAbort)
      }
      worker.removeEventListener('message', handleMessage)
      worker.removeEventListener('error', handleWorkerError)
      if (terminateWorker) {
        worker.terminate()
      }
    }

    const finishWithHash = (hash: string) => {
      if (settled) {
        return
      }
      settled = true
      cleanup(false)
      warmWorker = worker
      warmWorkerPrewarmPromise = Promise.resolve()
      resolve(hash)
    }

    const finishWithError = (error: Error | DOMException) => {
      if (settled) {
        return
      }
      settled = true
      cleanup(true)
      reject(error)
    }

    const handleAbort = () => {
      finishWithError(createAbortError())
    }

    const handleWorkerError = () => {
      finishWithError(new Error('Failed to initialize hash worker'))
    }

    const handleMessage = (event: MessageEvent<HashWorkerMessage>) => {
      const message = event.data
      if (!message) {
        return
      }

      if (message.type === 'progress') {
        if (message.requestId !== requestId) {
          return
        }
        onProgress?.(message.loaded, message.total)
        return
      }

      if (message.type === 'done') {
        if (message.requestId !== requestId) {
          return
        }
        finishWithHash(message.hash)
        return
      }

      if (message.type === 'error') {
        if (message.requestId !== requestId) {
          return
        }
        finishWithError(new Error(message.error || 'Failed to hash file in worker'))
      }
    }

    if (signal) {
      signal.addEventListener('abort', handleAbort, {
        once: true
      })
    }

    worker.addEventListener('message', handleMessage)
    worker.addEventListener('error', handleWorkerError)

    void ready
      .then(() => {
        if (settled) {
          return
        }

        const startMessage: HashWorkerStartMessage = {
          type: 'start',
          requestId,
          file
        }
        worker.postMessage(startMessage)
      })
      .catch(error => {
        finishWithError(toError(error, 'Failed to prewarm hash worker'))
      })
  })
}
