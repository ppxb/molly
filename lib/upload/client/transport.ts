interface UploadBlobWithProgressInput {
  uploadUrl: string
  blob: Blob
  contentType: string
  signal?: AbortSignal
  onProgress?: (loaded: number, total: number) => void
}

export function uploadBlobWithProgress(input: UploadBlobWithProgressInput) {
  return new Promise<{ eTag: string }>((resolve, reject) => {
    if (input.signal?.aborted) {
      reject(new DOMException('Upload aborted', 'AbortError'))
      return
    }

    const xhr = new XMLHttpRequest()
    const handleAbort = () => {
      xhr.abort()
      reject(new DOMException('Upload aborted', 'AbortError'))
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

      const etag = xhr.getResponseHeader('ETag')?.replaceAll('"', '') ?? ''
      resolve({
        eTag: etag
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
