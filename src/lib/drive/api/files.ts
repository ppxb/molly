import type {
  FileAccessUrlResponse,
  FileCompleteResponse,
  FileCreateWithFoldersResponse,
  FileGetFolderSizeInfoResponse,
  FileGetLatestAsyncTaskResponse,
  FileGetPathResponse,
  FileGetResponse,
  FileGetUploadURLResponse,
  FileListOrderBy,
  FileListResponse,
  FileSearchResponse,
  BatchRequest,
  BatchResponse,
  DriveBreadcrumbItem,
  DriveEntriesResponse,
  DriveMoveTargetsResponse,
  DriveFolderRecord,
  DriveFileRecord
} from '@/lib/drive/api/types'
import { buildBreadcrumbs, mapFileItem, mapFolderItem } from '@/lib/drive/api/mappers'
import { requestJSON } from '@/lib/drive/api/request'

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
  order_by?: FileListOrderBy
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
    order_by: input.order_by ?? 'name',
    order_direction: input.order_direction ?? 'ASC'
  })
}

export function searchFileRequest(input: { query: string; drive_id?: string; order_by?: string; limit?: number }) {
  return requestJSON<FileSearchResponse>('/v1/file/search', input)
}

export function listFileChildrenRequest(input: {
  drive_id?: string
  parent_file_id: string
  limit?: number
  marker?: string
  order_by?: FileListOrderBy
  order_direction?: 'ASC' | 'DESC'
}) {
  return listFileRequest({
    drive_id: input.drive_id,
    parent_file_id: input.parent_file_id,
    limit: input.limit ?? 200,
    marker: input.marker,
    order_by: input.order_by ?? 'name',
    order_direction: input.order_direction ?? 'ASC'
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

export function listFileEntriesRequest(
  folderId: string,
  options?: {
    order_by?: FileListOrderBy
    order_direction?: 'ASC' | 'DESC'
  }
) {
  const targetFolderId = folderId.trim() || 'root'

  return (async (): Promise<DriveEntriesResponse> => {
    let currentPath = ''
    let breadcrumbs: DriveBreadcrumbItem[] = [
      {
        id: 'root',
        label: 'root',
        path: ''
      }
    ]

    if (targetFolderId !== 'root') {
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
      parent_file_id: targetFolderId,
      order_by: options?.order_by ?? 'name',
      order_direction: options?.order_direction ?? 'ASC'
    })

    const folders: DriveFolderRecord[] = []
    const files: DriveFileRecord[] = []
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
  return requestJSON<DriveMoveTargetsResponse>('/v1/file/list_move_targets', {
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

export function batchFileRequest(input: BatchRequest) {
  return requestJSON<BatchResponse>('/v1/batch', input)
}

export function getFileAccessUrlRequest(input: { fileId: string; mode: 'preview' | 'download' }) {
  return requestJSON<FileAccessUrlResponse>('/v1/file/get_access_url', input)
}

export function deleteFileRequest(input: { drive_id?: string; file_id: string }) {
  return requestJSON<null>('/v1/file/delete', input)
}
