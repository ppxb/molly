import type { RecycleBinClearResponse, RecycleBinListResponse } from '@/lib/drive/client/api/types'
import { requestJSON } from '@/lib/drive/client/api/request'

export function recycleBinTrashRequest(input: { drive_id?: string; file_id: string }) {
  return requestJSON<null>('/v1/recyclebin/trash', input)
}

export function recycleBinRestoreRequest(input: { drive_id?: string; file_id: string }) {
  return requestJSON<null>('/v1/recyclebin/restore', input)
}

export function recycleBinClearRequest(input?: { drive_id?: string }) {
  return requestJSON<RecycleBinClearResponse>('/v1/recyclebin/clear', {
    drive_id: input?.drive_id
  })
}

export function recycleBinDeleteRequest(input: { drive_id?: string; file_id: string }) {
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
