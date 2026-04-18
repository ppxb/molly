import type {
  FileAccessUrlResponse,
  UploadBatchRequest,
  UploadBatchResponse,
  UploadBreadcrumbItem,
  UploadEntriesResponse,
  UploadFileRenameResponse,
  UploadFolderCreateResponse,
  UploadFolderRecord,
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

function inferFileExtension(fileName: string) {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot + 1 >= fileName.length) {
    return ''
  }
  return fileName.slice(dot + 1).toLowerCase()
}

function joinFolderPath(parentPath: string, childName: string) {
  const safeParent = parentPath.trim().replace(/^\/+|\/+$/g, '')
  const safeChild = childName.trim().replace(/^\/+|\/+$/g, '')
  if (!safeParent) {
    return safeChild
  }
  if (!safeChild) {
    return safeParent
  }
  return `${safeParent}/${safeChild}`
}

function buildBreadcrumbs(pathItems: FileGetPathItem[]): UploadBreadcrumbItem[] {
  const breadcrumbs: UploadBreadcrumbItem[] = [
    {
      id: 'root',
      label: 'root',
      path: ''
    }
  ]

  let currentPath = ''
  for (const item of pathItems) {
    currentPath = joinFolderPath(currentPath, item.name)
    breadcrumbs.push({
      id: item.file_id,
      label: item.name,
      path: currentPath
    })
  }

  return breadcrumbs
}

function mapFolderItem(item: FileListItem, currentPath: string): UploadFolderRecord {
  const folderPath = joinFolderPath(currentPath, item.name)
  return {
    id: item.file_id,
    folderName: item.name,
    parentId: item.parent_file_id || null,
    folderPath,
    parentPath: currentPath,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  }
}

function mapFileItem(item: FileListItem, currentPath: string): UploadedFileRecord {
  const fileName = item.name
  return {
    id: item.file_id,
    fileName,
    fileExtension: inferFileExtension(fileName),
    folderId: item.parent_file_id,
    folderPath: currentPath,
    contentType: item.mime_type || 'application/octet-stream',
    fileSize: item.size ?? 0,
    fileHash: item.content_hash || '',
    fileSampleHash: '',
    objectKey: '',
    bucket: '',
    strategy: 'single',
    createdAt: item.created_at,
    updatedAt: item.updated_at
  }
}

export function searchFileRequest(input: { query: string; drive_id?: string; order_by?: string; limit?: number }) {
  return requestJSON<FileSearchResponse>('/v1/file/search', input)
}

function getFileRequest(input: { drive_id?: string; file_id: string }) {
  return requestJSON<FileGetResponse>('/v1/file/get', input)
}

function getFilePathRequest(input: { drive_id?: string; file_id: string }) {
  return requestJSON<FileGetPathResponse>('/v1/file/get_path', input)
}

function listFileRequest(input: {
  drive_id?: string
  parent_file_id: string
  limit?: number
  all?: boolean
  url_expire_sec?: number
  image_thumbnail_process?: string
  image_url_process?: string
  video_thumbnail_process?: string
  fields?: string
  order_by?: string
  order_direction?: 'ASC' | 'DESC'
}) {
  return requestJSON<FileListResponse>('/v1/file/list', {
    parent_file_id: input.parent_file_id,
    drive_id: input.drive_id,
    limit: input.limit ?? 200,
    all: input.all ?? false,
    url_expire_sec: input.url_expire_sec ?? 14400,
    image_thumbnail_process: input.image_thumbnail_process ?? 'image/resize,w_256/format,avif',
    image_url_process: input.image_url_process ?? 'image/resize,w_1920/format,avif',
    video_thumbnail_process:
      input.video_thumbnail_process ?? 'video/snapshot,t_120000,f_jpg,m_lfit,w_256,ar_auto,m_fast',
    fields: input.fields ?? '*',
    order_by: input.order_by ?? 'updated_at',
    order_direction: input.order_direction ?? 'DESC'
  })
}

export function createWithFoldersFileRequest(input: {
  drive_id?: string
  part_info_list: Array<{ part_number: number }>
  parent_file_id: string
  name: string
  type: 'file' | 'folder'
  check_name_mode?: 'auto_rename' | 'refuse'
  size?: number
  create_scene?: string
  device_name?: string
  local_modified_at?: string
  pre_hash?: string
  content_type?: string
  chunk_size?: number
}) {
  return requestJSON<FileCreateWithFoldersResponse>('/v1/file/create_with_folders', input)
}

export function getUploadURLFileRequest(input: {
  drive_id?: string
  upload_id: string
  part_info_list: Array<{ part_number: number }>
  file_id: string
}) {
  return requestJSON<FileGetUploadURLResponse>('/v1/file/get_upload_url', input)
}

export function completeFileRequest(input: { drive_id?: string; upload_id: string; file_id: string }) {
  return requestJSON<FileCompleteResponse>('/v1/file/complete', input)
}

export function listUploadEntriesRequest(folderId: string) {
  const targetFolderId = folderId.trim() || 'root'

  return (async (): Promise<UploadEntriesResponse> => {
    let currentPath = ''
    let breadcrumbs: UploadBreadcrumbItem[] = [
      {
        id: 'root',
        label: 'root',
        path: ''
      }
    ]

    if (targetFolderId !== 'root') {
      // Keep aligned with Aliyun flow: get file meta -> get path -> list children.
      await getFileRequest({
        file_id: targetFolderId
      })

      const pathData = await getFilePathRequest({
        file_id: targetFolderId
      })
      breadcrumbs = buildBreadcrumbs(pathData.items)
      const current = breadcrumbs[breadcrumbs.length - 1]
      currentPath = current?.path || ''
    }

    const listData = await listFileRequest({
      parent_file_id: targetFolderId
    })

    const folders: UploadFolderRecord[] = []
    const files: UploadedFileRecord[] = []
    for (const item of listData.items) {
      if (item.type === 'folder') {
        folders.push(mapFolderItem(item, currentPath))
        continue
      }
      files.push(mapFileItem(item, currentPath))
    }

    const parentPath = breadcrumbs.length > 1 ? (breadcrumbs[breadcrumbs.length - 2]?.path ?? '') : null

    return {
      folderId: targetFolderId,
      path: currentPath,
      parentPath,
      breadcrumbs,
      folders,
      files
    }
  })()
}

export function createUploadFolderRequest(input: { parentFolderId?: string; folderName: string }) {
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

export function uploadBatchRequest(input: UploadBatchRequest) {
  return requestJSON<UploadBatchResponse>('/v1/upload/batch', input)
}

export function getFileAccessUrlRequest(input: { fileId: string; mode: 'preview' | 'download' }) {
  return requestJSON<FileAccessUrlResponse>('/v1/upload/file/access_url', input)
}
