export type * from '@/features/upload/transfer-queue-types'
export type * from '@/lib/drive/upload/types'
export type * from '@/lib/drive/types'

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

export interface RecycleBinFileRecord extends DriveFileRecord {
  trashedAt: string
  expiresAt: string
  recycleURL: string
}

export interface RecycleBinFolderRecord extends DriveFolderRecord {
  trashedAt: string
  expiresAt: string
}

export interface DriveBreadcrumbItem {
  id: string
  label: string
  path: string
}

export interface DriveEntriesResponse {
  folderId: string
  path: string
  parentPath: string | null
  breadcrumbs: DriveBreadcrumbItem[]
  folders: DriveFolderRecord[]
  files: DriveFileRecord[]
}

export interface DriveMoveTargetsResponse {
  folders: DriveFolderRecord[]
}

export interface RecycleBinEntriesResponse {
  folders: RecycleBinFolderRecord[]
  files: RecycleBinFileRecord[]
  nextMarker: string
}

export interface FileAccessUrlResponse {
  file: DriveFileRecord
  url: string
  disposition: 'inline' | 'attachment'
  expiresInSeconds: number
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
