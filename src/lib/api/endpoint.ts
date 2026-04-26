// src/lib/api/endpoints.ts — 所有 API 调用的唯一入口

import { http } from './client'
import type {
  LoginReq,
  LoginResp,
  UserResp,
  FileListResp,
  PrecheckReq,
  PrecheckResp,
  UploadResp,
  DeleteFilesResp,
  RecycledListResp,
  EmptyResp,
  PageReq
} from './types'

// ── 认证 ─────────────────────────────────────────────────────

export const authApi = {
  login: (body: LoginReq) => http.post<LoginResp>('/api/auth/login', body),
  me: () => http.get<UserResp>('/api/users/me')
}

// ── 文件 ─────────────────────────────────────────────────────

export const fileApi = {
  list: (pathId: string, page: number, pageSize: number) =>
    http.get<FileListResp>('/api/files', { virtualPath: pathId, page, pageSize }),

  precheck: (body: PrecheckReq) => http.post<PrecheckResp>('/api/files/precheck', body),

  uploadChunk: (form: FormData) => http.upload<UploadResp>('/api/files/upload', form),

  makeDir: (parentLevel: string, dirPath: string) =>
    http.post<null>('/api/files/dirs', { parent_level: parentLevel, dir_path: dirPath }),

  renameDir: (id: number, newName: string) =>
    http.put<null>(`/api/files/dirs/${id}/rename`, { dir_id: id, new_dir_name: newName }),

  deleteDir: (id: number) => http.delete<null>(`/api/files/dirs/${id}`),

  deleteFiles: (fileIds: string[]) => http.delete<DeleteFilesResp>('/api/files', { file_ids: fileIds }),

  moveFile: (fileId: string, targetPath: string) =>
    http.put<null>('/api/files/move', { file_id: fileId, target_path: targetPath }),

  renameFile: (fileId: string, newName: string) =>
    http.put<null>('/api/files/rename', { file_id: fileId, new_file_name: newName }),

  setPublic: (fileId: string, isPublic: boolean) =>
    http.put<null>('/api/files/public', { file_id: fileId, public: isPublic })
}

// ── 回收站 ────────────────────────────────────────────────────

export const recycledApi = {
  list: ({ page, pageSize }: PageReq) => http.get<RecycledListResp>('/api/recycled', { page, pageSize }),

  restore: (recycledId: string) => http.post<{ message: string }>('/api/recycled/restore', { recycled_id: recycledId }),

  deletePermanently: (id: string) => http.delete<null>(`/api/recycled/${id}`),

  empty: () => http.delete<EmptyResp>('/api/recycled')
}
