import type {
  FileAccessUrlResponse,
  InstantCheckResponse,
  MultipartPartUrlResponse,
  MultipartStatusResponse,
  MultipartUploadInitResponse,
  SingleUploadCompleteResponse,
  SingleUploadInitResponse,
  UploadBatchRequest,
  UploadBatchResponse,
  UploadEntriesResponse,
  UploadFileMoveResponse,
  UploadFileRenameResponse,
  UploadFolderCreateResponse,
  UploadFolderMoveResponse,
  UploadFolderRenameResponse,
  UploadMoveTargetsResponse,
  UploadedFileRecord
} from '@/lib/upload/shared'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8080'

function resolveAPIBaseURL() {
  const envValue = import.meta.env.VITE_API_BASE_URL
  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return envValue.trim().replace(/\/+$/, '')
  }

  return DEFAULT_API_BASE_URL
}

const API_BASE_URL = resolveAPIBaseURL()

interface APIErrorBody {
  code?: string
  message?: string
  request_id?: string
}

async function requestJSON<T>(path: string, body: unknown = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const raw = await response.text()
  let payload: unknown = null
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = raw
    }
  }

  if (!response.ok) {
    const errorBody = (payload && typeof payload === 'object' ? payload : null) as APIErrorBody | null
    const baseMessage = errorBody?.message || `Request failed with status ${response.status}`
    const requestID = errorBody?.request_id
    throw new Error(requestID ? `${baseMessage} (request_id: ${requestID})` : baseMessage)
  }

  return payload as T
}

export function listUploadedFilesRequest() {
  return requestJSON<{ files: UploadedFileRecord[] }>('/v1/upload/files', {}).then(response => response.files)
}

export function listUploadEntriesRequest(folderId: string) {
  return requestJSON<UploadEntriesResponse>('/v1/upload/entries', {
    folder_id: folderId
  })
}

export function createUploadFolderRequest(input: { parentFolderId?: string; parentPath?: string; folderName: string }) {
  return requestJSON<UploadFolderCreateResponse>('/v1/upload/folder/create', {
    parentFolderId: input.parentFolderId,
    folderName: input.folderName
  })
}

export function listUploadMoveTargetsRequest(input?: { excludeFolderId?: string }) {
  return requestJSON<UploadMoveTargetsResponse>('/v1/upload/move_targets', {
    excludeFolderId: input?.excludeFolderId
  })
}

export function renameUploadedFileRequest(input: { fileId: string; fileName: string }) {
  return requestJSON<UploadFileRenameResponse>('/v1/upload/file/rename', input)
}

export function renameUploadFolderRequest(input: { folderId: string; folderName: string }) {
  return requestJSON<UploadFolderRenameResponse>('/v1/upload/folder/rename', input)
}

export function moveUploadedFileRequest(input: { fileId: string; targetFolderId: string }) {
  return requestJSON<UploadFileMoveResponse>('/v1/upload/file/move', input)
}

export function moveUploadFolderRequest(input: { folderId: string; targetParentId: string }) {
  return requestJSON<UploadFolderMoveResponse>('/v1/upload/folder/move', input)
}

export function uploadBatchRequest(input: UploadBatchRequest) {
  return requestJSON<UploadBatchResponse>('/v1/upload/batch', input)
}

export function instantCheckRequest(input: {
  fileHash?: string
  fileSampleHash?: string
  fileSize?: number
  fileName?: string
  contentType?: string
  folderId?: string
}) {
  return requestJSON<InstantCheckResponse>('/v1/upload/instant_check', input)
}

export function initSingleUploadRequest(input: {
  fileName: string
  folderId?: string
  contentType: string
  fileSize: number
  fileSampleHash: string
  fileHash?: string
}) {
  return requestJSON<SingleUploadInitResponse>('/v1/upload/single/init', input)
}

export function completeSingleUploadRequest(input: {
  sessionId: string
  fileHash?: string
  eTag?: string
  size?: number
}) {
  return requestJSON<SingleUploadCompleteResponse>('/v1/upload/single/complete', input)
}

export function initMultipartUploadRequest(input: {
  fileName: string
  folderId?: string
  contentType: string
  fileSize: number
  fileSampleHash: string
  fileHash?: string
  chunkSize: number
  resumeSessionId?: string
}) {
  return requestJSON<MultipartUploadInitResponse>('/v1/upload/multipart/init', input)
}

export function getMultipartStatusRequest(sessionId: string) {
  return requestJSON<MultipartStatusResponse>('/v1/upload/multipart/status', {
    sessionId
  })
}

export function getMultipartPartUrlRequest(sessionId: string, partNumber: number) {
  return requestJSON<MultipartPartUrlResponse>('/v1/upload/multipart/part_url', {
    sessionId,
    partNumber
  })
}

export function reportMultipartPartCompletedRequest(input: {
  sessionId: string
  partNumber: number
  size: number
  eTag: string
}) {
  return requestJSON<{ uploadedBytes: number; uploadedParts: number }>('/v1/upload/multipart/report_part', input)
}

export function completeMultipartUploadRequest(input: { sessionId: string; fileHash?: string }) {
  return requestJSON<SingleUploadCompleteResponse>('/v1/upload/multipart/complete', input)
}

export function abortMultipartUploadRequest(sessionId: string) {
  return requestJSON<{ aborted: boolean }>('/v1/upload/multipart/abort', {
    sessionId
  })
}

export function getFileAccessUrlRequest(input: { fileId: string; mode: 'preview' | 'download' }) {
  return requestJSON<FileAccessUrlResponse>('/v1/upload/file/access_url', input)
}

export function syncUploadedFileHashRequest(input: { fileId: string; fileHash: string }) {
  return requestJSON<{
    updated: boolean
    file: UploadedFileRecord
    conflictFile?: UploadedFileRecord
  }>('/v1/upload/file/sync_hash', input)
}
