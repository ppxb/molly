export type {
  FileAccessUrlResponse,
  UploadBatchRequest,
  UploadBatchResponse,
  UploadBatchResponseItem,
  UploadBreadcrumbItem,
  UploadEntriesResponse,
  UploadFolderRecord,
  UploadMoveTargetsResponse,
  UploadedFileRecord
} from '@/lib/drive/shared'

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

export interface FileUploadPartInfo {
  part_number: number
  upload_url: string
  internal_upload_url?: string
  content_type?: string
}

export interface FileCreateWithFoldersResponse {
  parent_file_id: string
  part_info_list: FileUploadPartInfo[]
  upload_id: string
  rapid_upload: boolean
  type: 'file' | 'folder'
  file_id: string
  revision_id: string
  domain_id: string
  drive_id: string
  file_name: string
  encrypt_mode: string
  location: string
  created_at?: string
  updated_at?: string
}

export interface FileGetUploadURLResponse {
  domain_id: string
  drive_id: string
  file_id: string
  part_info_list: FileUploadPartInfo[]
  upload_id: string
  create_at: string
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
  punish_flag?: number
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

export type FileListOrderBy = 'name' | 'created_at' | 'updated_at' | 'size'

export interface FileGetResponse {
  drive_id: string
  domain_id: string
  file_id: string
  name: string
  type: 'file' | 'folder'
  content_type?: string
  created_at: string
  updated_at: string
  hidden: boolean
  starred: boolean
  status: string
  parent_file_id: string
  encrypt_mode: string
  meta_name_punish_flag: number
  meta_name_investigation_status: number
  creator_type?: string
  creator_id?: string
  last_modifier_type?: string
  last_modifier_id?: string
  sync_flag: boolean
  sync_device_flag: boolean
  sync_meta: string
  trashed: boolean
  download_url: string
  url: string
}

export interface FileGetPathItem {
  trashed: boolean
  drive_id: string
  file_id: string
  created_at: string
  domain_id: string
  encrypt_mode: string
  hidden: boolean
  name: string
  parent_file_id: string
  starred: boolean
  status: string
  type: 'file' | 'folder'
  updated_at: string
  sync_flag: boolean
}

export interface FileGetPathResponse {
  items: FileGetPathItem[]
}

export interface FileCompleteResponse {
  drive_id: string
  domain_id: string
  file_id: string
  name: string
  type: 'file' | 'folder'
  content_type?: string
  created_at?: string
  updated_at?: string
  modified_at?: string
  file_extension?: string
  hidden?: boolean
  size?: number
  starred?: boolean
  status?: string
  user_meta?: string
  upload_id?: string
  parent_file_id?: string
  crc64_hash?: string
  content_hash?: string
  content_hash_name?: string
  category?: string
  encrypt_mode?: string
  meta_name_punish_flag?: number
  meta_name_investigation_status?: number
  creator_type?: string
  creator_id?: string
  last_modifier_type?: string
  last_modifier_id?: string
  user_tags?: Record<string, string>
  local_modified_at?: string
  revision_id?: string
  revision_version?: number
  sync_flag?: boolean
  sync_device_flag?: boolean
  sync_meta?: string
  location?: string
  content_uri?: string
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

export interface RecycleBinListItem {
  name: string
  type: 'file' | 'folder'
  hidden: boolean
  status: string
  starred: boolean
  parent_file_id: string
  drive_id: string
  file_id: string
  encrypt_mode: string
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
  content_hash_name?: string
  punish_flag?: number
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
