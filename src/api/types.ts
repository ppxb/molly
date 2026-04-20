export type FileListOrderBy = 'name' | 'created_at' | 'updated_at' | 'size'

export interface FileUploadPartInfo {
  part_number: number
  upload_url: string
  internal_upload_url?: string
  content_type?: string
}

export interface FileListItem {
  category?: string
  content_hash?: string
  file_extension?: string
  created_at: string
  drive_id: string
  file_id: string
  mime_type?: string
  name: string
  parent_file_id: string
  size?: number
  starred: boolean
  sync_device_flag: boolean
  sync_flag: boolean
  sync_meta: string
  type: 'file' | 'folder'
  updated_at: string
  url: string
  user_meta?: string
  user_tags?: Record<string, string>
}

export interface FileListResponse {
  items: FileListItem[]
  next_marker: string
}

export interface FileGetResponse {
  drive_id: string
  domain_id: string
  file_id: string
  name: string
  type: 'file' | 'folder'
  created_at: string
  updated_at: string
  parent_file_id: string
  trashed: boolean
  download_url: string
  url: string
  [key: string]: unknown
}

export interface FileGetPathItem {
  file_id: string
  name: string
  parent_file_id: string
  type: 'file' | 'folder'
  created_at: string
  updated_at: string
  trashed: boolean
  [key: string]: unknown
}

export interface FileGetPathResponse {
  items: FileGetPathItem[]
}

export interface FileCreateWithFoldersResponse {
  parent_file_id: string
  part_info_list: FileUploadPartInfo[]
  upload_id: string
  rapid_upload: boolean
  type: 'file' | 'folder'
  file_id: string
  file_name: string
  drive_id: string
  domain_id: string
  location: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface FileGetUploadURLResponse {
  domain_id: string
  drive_id: string
  file_id: string
  part_info_list: FileUploadPartInfo[]
  upload_id: string
  create_at: string
}

export interface FileCompleteResponse {
  file_id: string
  name: string
  type: 'file' | 'folder'
  parent_file_id: string
  content_type?: string
  file_extension?: string
  size?: number
  content_hash?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface FileGetLatestAsyncTaskResponse {
  total_process: number
  total_failed_process: number
  total_skipped_process: number
  total_consumed_process: number
}

export interface FileGetFolderSizeInfoResponse {
  size: number
  folder_count: number
  file_count: number
  display_summary: string
}

export interface FileSearchItem {
  drive_id: string
  file_id: string
  parent_file_id: string
  name: string
  type: 'file' | 'folder'
  size: number
  created_at?: string
  updated_at?: string
}

export interface FileSearchResponse {
  items: FileSearchItem[]
  next_marker: string
}

export interface RecycleBinListItem {
  name: string
  type: 'file' | 'folder'
  parent_file_id: string
  drive_id: string
  file_id: string
  domain_id: string
  created_at: string
  updated_at: string
  trashed_at: string
  gmt_expired: string
  category?: string
  url?: string
  size?: number
  file_extension?: string
  content_hash?: string
  [key: string]: unknown
}

export interface RecycleBinListResponse {
  items: RecycleBinListItem[]
  next_marker: string
}

export interface RecycleBinClearResponse {
  domain_id: string
  drive_id: string
  task_id: string
  async_task_id: string
}
