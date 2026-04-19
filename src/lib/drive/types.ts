export const DEFAULT_MULTIPART_THRESHOLD = 32 * 1024 * 1024
export const DEFAULT_MULTIPART_CHUNK_SIZE = 8 * 1024 * 1024
export const SAMPLE_HASH_THRESHOLD = 32 * 1024 * 1024
export const SAMPLE_HASH_HEAD_SIZE = 4 * 1024 * 1024
export const SAMPLE_HASH_TAIL_SIZE = 4 * 1024 * 1024
export const SAMPLE_HASH_MIDDLE_PART_COUNT = 8
export const SAMPLE_HASH_MIDDLE_PART_SIZE = 1 * 1024 * 1024
export const SAMPLE_HASH_VERSION = 'sample-v1'

export type TransferStrategy = 'single' | 'multipart' | 'instant'
export type TransferStage = 'idle' | 'hashing' | 'checking' | 'uploading' | 'finalizing' | 'done' | 'error' | 'aborted'

export interface DriveFileRecord {
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
  strategy: TransferStrategy
  createdAt: string
  updatedAt: string
}

export interface DriveFolderRecord {
  id: string
  folderName: string
  parentId: string | null
  folderPath: string
  parentPath: string
  createdAt: string
  updatedAt: string
}

export interface FileAccessUrlResponse {
  file: DriveFileRecord
  url: string
  disposition: 'inline' | 'attachment'
  expiresInSeconds: number
}

export interface DriveEntriesResponse {
  folderId: string
  path: string
  parentPath: string | null
  breadcrumbs: DriveBreadcrumbItem[]
  folders: DriveFolderRecord[]
  files: DriveFileRecord[]
}

export interface DriveBreadcrumbItem {
  id: string
  label: string
  path: string
}

export interface DriveMoveTargetsResponse {
  folders: DriveFolderRecord[]
}

export interface RecycleBinFolderRecord extends DriveFolderRecord {
  trashedAt: string
  expiresAt: string
}

export interface RecycleBinFileRecord extends DriveFileRecord {
  trashedAt: string
  expiresAt: string
  recycleURL: string
}

export interface RecycleBinEntriesResponse {
  folders: RecycleBinFolderRecord[]
  files: RecycleBinFileRecord[]
  nextMarker: string
}

export interface BatchActionRequest {
  drive_id?: string
  file_id: string
  file_name?: string
  type: 'file' | 'folder'
  to_drive_id?: string
  to_parent_file_id: string
}

export interface BatchRequestItem {
  id: string
  method: 'POST'
  url: '/file/move'
  body: BatchActionRequest
  headers?: Record<string, string>
}

export interface BatchRequest {
  resource?: 'file'
  requests: BatchRequestItem[]
}

export interface BatchResponseItem {
  id: string
  status: number
  body?: Record<string, unknown>
}

export interface BatchResponse {
  responses: BatchResponseItem[]
}
