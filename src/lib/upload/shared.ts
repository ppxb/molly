export const DEFAULT_MULTIPART_THRESHOLD = 16 * 1024 * 1024
export const DEFAULT_MULTIPART_CHUNK_SIZE = 8 * 1024 * 1024
export const SAMPLE_HASH_THRESHOLD = 32 * 1024 * 1024
export const SAMPLE_HASH_HEAD_SIZE = 4 * 1024 * 1024
export const SAMPLE_HASH_TAIL_SIZE = 4 * 1024 * 1024
export const SAMPLE_HASH_MIDDLE_PART_COUNT = 8
export const SAMPLE_HASH_MIDDLE_PART_SIZE = 1 * 1024 * 1024
export const SAMPLE_HASH_VERSION = 'sample-v1'

export type UploadStrategy = 'single' | 'multipart' | 'instant'
export type UploadStage = 'idle' | 'hashing' | 'checking' | 'uploading' | 'finalizing' | 'done' | 'error' | 'aborted'

export interface UploadedFileRecord {
  id: string
  fileName: string
  fileExtension: string
  folderId: string
  folderPath: string
  contentType: string
  fileSize: number
  fileHash: string
  fileSampleHash: string
  objectKey: string
  bucket: string
  strategy: UploadStrategy
  createdAt: string
  updatedAt: string
}

export interface UploadFolderRecord {
  id: string
  folderName: string
  parentId: string | null
  folderPath: string
  parentPath: string
  createdAt: string
  updatedAt: string
}

export interface FileAccessUrlResponse {
  file: UploadedFileRecord
  url: string
  disposition: 'inline' | 'attachment'
  expiresInSeconds: number
}

export interface UploadEntriesResponse {
  folderId: string
  path: string
  parentPath: string | null
  breadcrumbs: UploadBreadcrumbItem[]
  folders: UploadFolderRecord[]
  files: UploadedFileRecord[]
}

export interface UploadBreadcrumbItem {
  id: string
  label: string
  path: string
}

export interface UploadFolderCreateResponse {
  folder: UploadFolderRecord
}

export interface UploadFileRenameResponse {
  file: UploadedFileRecord
}

export interface UploadFolderRenameResponse {
  folder: UploadFolderRecord
}

export interface UploadFileMoveResponse {
  file: UploadedFileRecord
}

export interface UploadFolderMoveResponse {
  folder: UploadFolderRecord
}

export interface UploadMoveTargetsResponse {
  folders: UploadFolderRecord[]
}

export interface UploadBatchActionRequest {
  fileId?: string
  folderId?: string
  targetFolderId?: string
  targetParentId?: string
  fileName?: string
  folderName?: string
}

export interface UploadBatchRequestItem {
  id: string
  method: 'POST'
  url: '/file/move' | '/folder/move' | '/file/rename' | '/folder/rename'
  body: UploadBatchActionRequest
}

export interface UploadBatchRequest {
  resource?: 'file' | 'folder'
  requests: UploadBatchRequestItem[]
}

export interface UploadBatchResponseItem {
  id: string
  success: boolean
  data?: UploadFileMoveResponse | UploadFolderMoveResponse | UploadFileRenameResponse | UploadFolderRenameResponse
  error?: string
}

export interface UploadBatchResponse {
  responses: UploadBatchResponseItem[]
}
