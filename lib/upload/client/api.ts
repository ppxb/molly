import type {
  FileAccessUrlResponse,
  InstantCheckResponse,
  MultipartPartUrlResponse,
  MultipartStatusResponse,
  MultipartUploadInitResponse,
  SingleUploadCompleteResponse,
  SingleUploadInitResponse,
  UploadedFileRecord
} from '@/lib/upload/shared'

interface ApiSuccessEnvelope<T> {
  ok: true
  data: T
}

interface ApiErrorEnvelope {
  ok: false
  error: string
}

async function request<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, {
    ...init,
    headers,
    cache: 'no-store'
  })

  const envelope = (await response.json().catch(() => null)) as ApiSuccessEnvelope<T> | ApiErrorEnvelope | null
  if (!response.ok || !envelope || envelope.ok === false) {
    const fallbackError = response.ok ? 'Unexpected response envelope' : `Request failed (${response.status})`
    const errorMessage = envelope && envelope.ok === false ? envelope.error : fallbackError
    throw new Error(errorMessage)
  }

  return envelope.data
}

export function listUploadedFilesRequest() {
  return request<UploadedFileRecord[]>('/api/uploads/files')
}

export function instantCheckRequest(input: { fileHash?: string; fileSampleHash?: string; fileSize?: number }) {
  return request<InstantCheckResponse>('/api/uploads/instant-check', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function initSingleUploadRequest(input: {
  fileName: string
  contentType: string
  fileSize: number
  fileSampleHash: string
  fileHash?: string
}) {
  return request<SingleUploadInitResponse>('/api/uploads/single/init', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function completeSingleUploadRequest(input: { sessionId: string; fileHash?: string }) {
  return request<SingleUploadCompleteResponse>('/api/uploads/single/complete', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function initMultipartUploadRequest(input: {
  fileName: string
  contentType: string
  fileSize: number
  fileSampleHash: string
  fileHash?: string
  chunkSize: number
  resumeSessionId?: string
}) {
  return request<MultipartUploadInitResponse>('/api/uploads/multipart/init', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function getMultipartStatusRequest(sessionId: string) {
  return request<MultipartStatusResponse>(`/api/uploads/multipart/${sessionId}/status`)
}

export function getMultipartPartUrlRequest(sessionId: string, partNumber: number) {
  return request<MultipartPartUrlResponse>(`/api/uploads/multipart/${sessionId}/part-url`, {
    method: 'POST',
    body: JSON.stringify({
      partNumber
    })
  })
}

export function reportMultipartPartCompletedRequest(input: {
  sessionId: string
  partNumber: number
  size: number
  eTag: string
}) {
  return request<{ uploadedBytes: number; uploadedParts: number }>(
    `/api/uploads/multipart/${input.sessionId}/part-complete`,
    {
      method: 'POST',
      body: JSON.stringify({
        partNumber: input.partNumber,
        size: input.size,
        eTag: input.eTag
      })
    }
  )
}

export function completeMultipartUploadRequest(input: { sessionId: string; fileHash?: string }) {
  return request<SingleUploadCompleteResponse>(`/api/uploads/multipart/${input.sessionId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      fileHash: input.fileHash
    })
  })
}

export function abortMultipartUploadRequest(sessionId: string) {
  return request<{ aborted: boolean }>(`/api/uploads/multipart/${sessionId}/abort`, {
    method: 'POST'
  })
}

export function getFileAccessUrlRequest(input: { fileId: string; mode: 'preview' | 'download' }) {
  const modeQuery = input.mode === 'preview' ? 'preview' : 'download'
  return request<FileAccessUrlResponse>(`/api/uploads/files/${input.fileId}/url?mode=${modeQuery}`)
}

export function syncUploadedFileHashRequest(input: { fileId: string; fileHash: string }) {
  return request<{
    updated: boolean
    file: UploadedFileRecord
    conflictFile?: UploadedFileRecord
  }>(`/api/uploads/files/${input.fileId}/hash-sync`, {
    method: 'POST',
    body: JSON.stringify({
      fileHash: input.fileHash
    })
  })
}
