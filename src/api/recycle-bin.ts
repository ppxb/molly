import { RecycleBinEntriesResponse, RecycleBinFileRecord, RecycleBinFolderRecord } from '@/types/drive'
import { RecycleBinClearResponse, RecycleBinListItem, RecycleBinListResponse } from './types'
import { request } from './client'

function inferExtension(name: string, ext?: string): string {
  if (ext?.trim()) return ext.trim().toLowerCase()
  const dot = name.lastIndexOf('.')
  if (dot <= 0 || dot + 1 >= name.length) return ''
  return name.slice(dot + 1).toLowerCase()
}

function mapRecycleFolder(item: RecycleBinListItem): RecycleBinFolderRecord {
  return {
    id: item.file_id,
    folderName: item.name,
    parentId: 'recyclebin',
    folderPath: item.name,
    parentPath: '',
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    trashedAt: item.trashed_at,
    expiresAt: item.gmt_expired
  }
}

function mapRecycleFile(item: RecycleBinListItem): RecycleBinFileRecord {
  return {
    id: item.file_id,
    fileName: item.name,
    fileExtension: inferExtension(item.name, item.file_extension),
    folderId: 'recyclebin',
    folderPath: '',
    contentType: 'application/octet-stream',
    fileSize: item.size ?? 0,
    fileHash: item.content_hash ?? '',
    fileSampleHash: '',
    objectKey: '',
    bucket: '',
    strategy: 'single',
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    trashedAt: item.trashed_at,
    expiresAt: item.gmt_expired,
    recycleURL: item.url ?? ''
  }
}

export async function listRecycleBin(opts?: { limit?: number; marker?: string }): Promise<RecycleBinEntriesResponse> {
  const data = await request<RecycleBinListResponse>('/v1/recyclebin/list', {
    limit: opts?.limit ?? 200,
    order_by: 'name',
    order_direction: 'DESC',
    marker: opts?.marker
  })

  const folders: RecycleBinFolderRecord[] = []
  const files: RecycleBinFileRecord[] = []

  for (const item of data.items) {
    if (item.type === 'folder') {
      folders.push(mapRecycleFolder(item))
    } else {
      files.push(mapRecycleFile(item))
    }
  }

  return { folders, files, nextMarker: data.next_marker ?? '' }
}

export function trashItem(fileId: string) {
  return request<null>('/v1/recyclebin/trash', { file_id: fileId })
}

export function restoreItem(fileId: string) {
  return request<null>('/v1/recyclebin/restore', { file_id: fileId })
}

export function deleteItemForever(fileId: string) {
  return request<null>('/v1/file/delete', { file_id: fileId })
}

export function clearRecycleBin() {
  return request<RecycleBinClearResponse>('/v1/recyclebin/clear', {})
}
