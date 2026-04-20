import {
  BatchRequest,
  BatchResponse,
  DriveBreadcrumbItem,
  DriveEntriesResponse,
  DriveFileRecord,
  DriveFolderRecord,
  DriveMoveTargetsResponse,
  FileAccessUrlResponse
} from '@/types/drive'
import {
  FileCompleteResponse,
  FileCreateWithFoldersResponse,
  FileGetFolderSizeInfoResponse,
  FileGetLatestAsyncTaskResponse,
  FileGetPathItem,
  FileGetPathResponse,
  FileGetResponse,
  FileGetUploadURLResponse,
  FileListItem,
  FileListOrderBy,
  FileListResponse,
  FileSearchResponse
} from './types'
import { request } from './client'

function inferExtension(fileName: string) {
  const dot = fileName.lastIndexOf('.')
  if (dot <= 0 || dot + 1 >= fileName.length) return ''
  return fileName.substring(dot + 1).toLowerCase()
}

function joinPath(parent: string, child: string) {
  const a = parent.trim().replace(/^\/+|\/+$/g, '')
  const b = child.trim().replace(/^\/+|\/+$/g, '')
  if (!a) return b
  if (!b) return a
  return `${a}/${b}`
}

function mapFolder(item: FileListItem, currentPath: string): DriveFolderRecord {
  return {
    id: item.file_id,
    folderName: item.name,
    parentId: item.parent_file_id || null,
    folderPath: joinPath(currentPath, item.name),
    parentPath: currentPath,
    createdAt: item.created_at,
    updatedAt: item.updated_at
  }
}

function mapFile(item: FileListItem, currentPath: string): DriveFileRecord {
  return {
    id: item.file_id,
    fileName: item.name,
    fileExtension: item.file_extension || inferExtension(item.name),
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

function buildBreadcrumbs(pathItems: FileGetPathItem[]): DriveBreadcrumbItem[] {
  const crumbs: DriveBreadcrumbItem[] = [{ id: 'root', label: 'root', path: '' }]
  let currentPath = ''
  for (const item of pathItems) {
    currentPath = joinPath(currentPath, item.name)
    crumbs.push({ id: item.file_id, label: item.name, path: currentPath })
  }
  return crumbs
}

export function getFile(fileId: string) {
  return request<FileGetResponse>('/v1/file/get', { file_id: fileId })
}

export function getFilePath(fileId: string) {
  return request<FileGetPathResponse>('/v1/file/get_path', { file_id: fileId })
}

export function searchFiles(query: string, limit = 1) {
  return request<FileSearchResponse>('/v1/file/search', { query, limit })
}

export async function listEntries(
  folderId: string,
  opts?: { orderBy?: FileListOrderBy; orderDirection?: 'ASC' | 'DESC' }
): Promise<DriveEntriesResponse> {
  const targetId = folderId.trim() || 'root'

  let currentPath = ''
  let breadcrumbs: DriveBreadcrumbItem[] = [{ id: 'root', label: 'root', path: '' }]

  if (targetId !== 'root') {
    await getFile(targetId)
    const pathData = await getFilePath(targetId)
    breadcrumbs = buildBreadcrumbs(pathData.items)
    currentPath = breadcrumbs[breadcrumbs.length - 1]?.path ?? ''
  }

  const listData = await request<FileListResponse>('/v1/file/list', {
    parent_file_id: targetId,
    limit: 200,
    order_by: opts?.orderBy ?? 'name',
    order_direction: opts?.orderDirection ?? 'ASC',
    url_expire_sec: 14400,
    fields: '*'
  })

  const folders: DriveFolderRecord[] = []
  const files: DriveFileRecord[] = []

  for (const item of listData.items) {
    if (item.type === 'folder') {
      folders.push(mapFolder(item, currentPath))
    } else {
      files.push(mapFile(item, currentPath))
    }
  }

  const parentPath = breadcrumbs.length > 1 ? (breadcrumbs[breadcrumbs.length - 2]?.path ?? '') : null

  return { folderId: targetId, path: currentPath, parentPath, breadcrumbs, folders, files }
}

export function createFolder(parentFolderId: string, folderName: string) {
  return request<FileCreateWithFoldersResponse>('/v1/file/create_with_folders', {
    parent_file_id: parentFolderId || 'root',
    name: folderName.trim(),
    type: 'folder',
    check_name_mode: 'refuse'
  })
}

export function renameItem(fileId: string, name: string) {
  return request<FileGetResponse>('/v1/file/update', {
    file_id: fileId,
    name,
    check_name_mode: 'refuse'
  })
}

export function listMoveTargets(excludeFolderId?: string) {
  return request<DriveMoveTargetsResponse>('/v1/file/list_move_targets', { excludeFolderId })
}

export function getFileAccessUrl(fileId: string, mode: 'preview' | 'download') {
  return request<FileAccessUrlResponse>('/v1/file/get_access_url', { fileId, mode })
}

export function getFolderSizeInfo(fileId: string) {
  return request<FileGetFolderSizeInfoResponse>('/v1/file/get_folder_size_info', { file_id: fileId })
}

export function getLatestAsyncTask() {
  return request<FileGetLatestAsyncTaskResponse>('/v1/file/get_latest_async_task', {})
}

export function batchRequest(input: BatchRequest) {
  return request<BatchResponse>('/v1/batch', input)
}

export function createUploadSession(input: {
  parentFileId: string
  name: string
  size: number
  checkNameMode: 'auto_rename' | 'refuse' | 'overwrite'
  partInfoList: Array<{ part_number: number }>
  preHash?: string
  contentType?: string
  chunkSize?: number
  localModifiedAt?: string
}) {
  return request<FileCreateWithFoldersResponse>('/v1/file/create_with_folders', {
    parent_file_id: input.parentFileId,
    name: input.name,
    type: 'file',
    check_name_mode: input.checkNameMode,
    size: input.size,
    create_scene: 'file_upload',
    device_name: 'web',
    pre_hash: input.preHash,
    content_type: input.contentType,
    chunk_size: input.chunkSize,
    local_modified_at: input.localModifiedAt,
    part_info_list: input.partInfoList
  })
}

export function getUploadPartUrls(fileId: string, uploadId: string, partNumbers: number[]) {
  return request<FileGetUploadURLResponse>('/v1/file/get_upload_url', {
    file_id: fileId,
    upload_id: uploadId,
    part_info_list: partNumbers.map(n => ({ part_number: n }))
  })
}

export function completeUpload(fileId: string, uploadId: string) {
  return request<FileCompleteResponse>('/v1/file/complete', {
    file_id: fileId,
    upload_id: uploadId
  })
}
