interface PutBlobInput {
  uploadUrl: string
  blob: Blob
  contentType: string
  signal?: AbortSignal
  onProgress?: (loaded: number, total: number) => void
}

function createAbortError() {
  return new DOMException('Upload aborted', 'AbortError')
}

export function putBlob(input: PutBlobInput): Promise<{ eTag: string }> {
  return new Promise((resolve, reject) => {
    if (input.signal?.aborted) {
      reject(createAbortError())
      return
    }

    const xhr = new XMLHttpRequest()

    const handleAbort = () => {
      xhr.abort()
      reject(createAbortError())
    }

    input.signal?.addEventListener('abort', handleAbort, { once: true })

    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        input.onProgress?.(event.loaded, event.total)
      }
    }

    xhr.onerror = () => reject(new Error('上传到对象存储时发生网络错误'))

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`对象存储上传失败 (${xhr.status})`))
        return
      }
      const eTag = xhr.getResponseHeader('ETag')?.replaceAll('"', '') ?? ''
      resolve({ eTag })
    }

    xhr.onloadend = () => {
      input.signal?.removeEventListener('abort', handleAbort)
    }

    xhr.open('PUT', input.uploadUrl, true)
    xhr.setRequestHeader('Content-Type', input.contentType || 'application/octet-stream')
    xhr.send(input.blob)
  })
}
