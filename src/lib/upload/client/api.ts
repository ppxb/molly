import type {
  FileAccessUrlResponse,
  UploadBatchRequest,
  UploadBatchResponseItem,
  UploadBatchResponse,
  UploadBreadcrumbItem,
  UploadEntriesResponse,
  UploadFolderRecord,
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
  code?: unknown
  message?: unknown
  request_id?: unknown
  requestId?: unknown
  body?: unknown
  error?: unknown
  data?: unknown
}

interface ParsedAPIError {
  code?: string
  message?: string
  requestId?: string
}

interface CreateAPIRequestErrorInput {
  status: number
  path: string
  payload: unknown
  fallbackMessage: string
}

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object') {
    return null
  }
  return input as Record<string, unknown>
}

function readStringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function parseErrorRecord(record: Record<string, unknown> | null): ParsedAPIError {
  if (!record) {
    return {}
  }

  const body = record as APIErrorBody
  return {
    code: readStringValue(body.code),
    message: readStringValue(body.message),
    requestId: readStringValue(body.request_id) ?? readStringValue(body.requestId)
  }
}

function parseAPIErrorPayload(payload: unknown): ParsedAPIError {
  if (typeof payload === 'string') {
    return {
      message: readStringValue(payload)
    }
  }

  const root = asRecord(payload)
  if (!root) {
    return {}
  }

  const rootParsed = parseErrorRecord(root)
  if (rootParsed.code || rootParsed.message || rootParsed.requestId) {
    return rootParsed
  }

  const wrappers: unknown[] = [root['body'], root['error'], root['data']]
  for (const wrapper of wrappers) {
    const parsed = parseErrorRecord(asRecord(wrapper))
    if (parsed.code || parsed.message || parsed.requestId) {
      return parsed
    }
  }

  return {}
}

export class APIRequestError extends Error {
  readonly status: number
  readonly code?: string
  readonly requestId?: string
  readonly path: string
  readonly details: unknown

  constructor(input: {
    status: number
    message: string
    path: string
    details: unknown
    code?: string
    requestId?: string
  }) {
    const renderedMessage = input.requestId ? `${input.message} (request_id: ${input.requestId})` : input.message
    super(renderedMessage)
    this.name = 'APIRequestError'
    this.status = input.status
    this.code = input.code
    this.requestId = input.requestId
    this.path = input.path
    this.details = input.details
  }
}

export function createAPIRequestError(input: CreateAPIRequestErrorInput): APIRequestError {
  const parsed = parseAPIErrorPayload(input.payload)
  const message = parsed.message ?? input.fallbackMessage

  return new APIRequestError({
    status: input.status,
    path: input.path,
    details: input.payload,
    message,
    code: parsed.code,
    requestId: parsed.requestId
  })
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof APIRequestError) {
    return error.message
  }

  if (error instanceof Error) {
    const normalized = error.message.trim()
    return normalized.length > 0 ? normalized : fallback
  }

  if (typeof error === 'string') {
    const normalized = error.trim()
    return normalized.length > 0 ? normalized : fallback
  }

  return fallback
}

export function createBatchItemError(item: UploadBatchResponseItem | undefined, fallbackMessage: string) {
  if (!item) {
    return createAPIRequestError({
      status: 500,
      path: '/v1/batch',
      payload: null,
      fallbackMessage
    })
  }

  return createAPIRequestError({
    status: item.status,
    path: '/v1/batch',
    payload: item.body,
    fallbackMessage
  })
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

async function requestJSON<T>(path: string, body: unknown = {}) {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
  } catch (error) {
    throw createAPIRequestError({
      status: 0,
      path,
      payload: error,
      fallbackMessage: 'Network request failed'
    })
  }

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
    throw createAPIRequestError({
      status: response.status,
      path,
      payload,
      fallbackMessage: `Request failed with status ${response.status}`
    })
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
    fileExtension: item.file_extension || inferFileExtension(fileName),
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
  marker?: string
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
    marker: input.marker,
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

export function listFileChildrenRequest(input: {
  drive_id?: string
  parent_file_id: string
  limit?: number
  marker?: string
  order_by?: string
  order_direction?: 'ASC' | 'DESC'
}) {
  return listFileRequest({
    drive_id: input.drive_id,
    parent_file_id: input.parent_file_id,
    limit: input.limit ?? 200,
    marker: input.marker,
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
  check_name_mode?: 'auto_rename' | 'refuse' | 'overwrite'
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

export function createFolderRequest(input: { parentFolderId?: string; folderName: string }) {
  return requestJSON<FileCreateWithFoldersResponse>('/v1/file/create_with_folders', {
    parent_file_id: input.parentFolderId || 'root',
    name: input.folderName,
    type: 'folder',
    check_name_mode: 'refuse'
  })
}

export function listMoveTargetsRequest(input?: { excludeFolderId?: string }) {
  return requestJSON<UploadMoveTargetsResponse>('/v1/file/list_move_targets', {
    excludeFolderId: input?.excludeFolderId
  })
}

export function updateFileRequest(input: {
  drive_id?: string
  file_id: string
  name: string
  check_name_mode?: 'refuse' | 'auto_rename' | 'overwrite'
}) {
  return requestJSON<FileGetResponse>('/v1/file/update', input)
}

export function getLatestAsyncTaskRequest(input?: { drive_id?: string }) {
  return requestJSON<FileGetLatestAsyncTaskResponse>('/v1/file/get_latest_async_task', input ?? {})
}

export function getFolderSizeInfoRequest(input: { drive_id?: string; file_id: string }) {
  return requestJSON<FileGetFolderSizeInfoResponse>('/v1/file/get_folder_size_info', input)
}

export function uploadBatchRequest(input: UploadBatchRequest) {
  return requestJSON<UploadBatchResponse>('/v1/batch', input)
}

export function getFileAccessUrlRequest(input: { fileId: string; mode: 'preview' | 'download' }) {
  return requestJSON<FileAccessUrlResponse>('/v1/file/get_access_url', input)
}

export function recycleBinTrashRequest(input: { drive_id?: string; file_id: string }) {
  return requestJSON<null>('/v1/recyclebin/trash', input)
}

export function recycleBinRestoreRequest(input: { drive_id?: string; file_id: string }) {
  return requestJSON<null>('/v1/recyclebin/restore', input)
}

export function recycleBinDeleteRequest(input: { drive_id?: string; file_id: string }) {
  return requestJSON<null>('/v1/file/delete', input)
}

export function deleteFileRequest(input: { drive_id?: string; file_id: string }) {
  return requestJSON<null>('/v1/file/delete', input)
}

export function listRecycleBinRequest(input?: {
  drive_id?: string
  limit?: number
  order_by?: string
  order_direction?: 'ASC' | 'DESC'
  marker?: string
}) {
  return requestJSON<RecycleBinListResponse>('/v1/recyclebin/list', {
    drive_id: input?.drive_id,
    limit: input?.limit ?? 20,
    order_by: input?.order_by ?? 'name',
    order_direction: input?.order_direction ?? 'DESC',
    marker: input?.marker
  })
}
