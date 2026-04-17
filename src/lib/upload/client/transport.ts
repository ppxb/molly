interface UploadBlobWithProgressInput {
  uploadUrl: string
  blob: Blob
  contentType: string
  signal?: AbortSignal
  onProgress?: (loaded: number, total: number) => void
}

function createAbortError() {
  return new DOMException('Upload aborted', 'AbortError')
}

function createMockEtag() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`).replaceAll(
    '-',
    ''
  )
}

function uploadBlobToMockStorage(input: UploadBlobWithProgressInput) {
  return new Promise<{ eTag: string }>((resolve, reject) => {
    if (input.signal?.aborted) {
      reject(createAbortError())
      return
    }

    const total = input.blob.size
    input.onProgress?.(0, total)

    if (total <= 0) {
      setTimeout(() => {
        if (input.signal?.aborted) {
          reject(createAbortError())
          return
        }

        resolve({
          eTag: createMockEtag()
        })
      }, 10)
      return
    }

    const durationMs = Math.min(2400, Math.max(240, Math.floor((total / (1.6 * 1024 * 1024)) * 1000)))
    const startAt = Date.now()

    let timer: ReturnType<typeof setInterval> | null = null
    const cleanup = () => {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      if (input.signal) {
        input.signal.removeEventListener('abort', handleAbort)
      }
    }

    const handleAbort = () => {
      cleanup()
      reject(createAbortError())
    }

    if (input.signal) {
      input.signal.addEventListener('abort', handleAbort, {
        once: true
      })
    }

    timer = setInterval(() => {
      if (input.signal?.aborted) {
        handleAbort()
        return
      }

      const elapsed = Date.now() - startAt
      const progress = Math.min(1, elapsed / durationMs)
      const loaded = Math.min(total, Math.round(total * progress))
      input.onProgress?.(loaded, total)

      if (progress >= 1) {
        cleanup()
        resolve({
          eTag: createMockEtag()
        })
      }
    }, 50)
  })
}

function uploadBlobToObjectStorage(input: UploadBlobWithProgressInput) {
  return new Promise<{ eTag: string }>((resolve, reject) => {
    if (input.signal?.aborted) {
      reject(createAbortError())
      return
    }

    const xhr = new XMLHttpRequest()
    const handleAbort = () => {
      xhr.abort()
      reject(createAbortError())
    }

    if (input.signal) {
      input.signal.addEventListener('abort', handleAbort, {
        once: true
      })
    }

    xhr.upload.onprogress = event => {
      if (!event.lengthComputable || !input.onProgress) {
        return
      }

      input.onProgress(event.loaded, event.total)
    }

    xhr.onerror = () => {
      reject(new Error('Network error while uploading to object storage'))
    }

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Object storage upload failed (${xhr.status})`))
        return
      }

      const eTag = xhr.getResponseHeader('ETag')?.replaceAll('"', '') ?? ''
      resolve({
        eTag
      })
    }

    xhr.onloadend = () => {
      if (input.signal) {
        input.signal.removeEventListener('abort', handleAbort)
      }
    }

    xhr.open('PUT', input.uploadUrl, true)
    xhr.setRequestHeader('Content-Type', input.contentType || 'application/octet-stream')
    xhr.send(input.blob)
  })
}

export function uploadBlobWithProgress(input: UploadBlobWithProgressInput) {
  if (input.uploadUrl.startsWith('mock://')) {
    return uploadBlobToMockStorage(input)
  }

  return uploadBlobToObjectStorage(input)
}
