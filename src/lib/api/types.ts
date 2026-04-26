// src/lib/api/types.ts — 与 molly-server DTO 一一对应，不做任何转换

// ── 通用 ─────────────────────────────────────────────────────

export interface PageReq {
  page: number
  pageSize: number
}

// ── 认证 ─────────────────────────────────────────────────────

export interface LoginReq {
  user_name: string
  password: string
}

export interface LoginResp {
  token: string
  user_id: string
  user_name: string
  name: string
  group_id: number
  powers: string[]
  space: number
}

export interface UserResp {
  id: string
  name: string
  user_name: string
  email: string
  phone: string
  group_id: number
  space: number
  free_space: number
  state: number
}

// ── 文件列表 ──────────────────────────────────────────────────

export interface BreadcrumbItem {
  id: number
  name: string
  path: string
}

export interface FolderItem {
  id: number
  name: string
  path: string
  created_time: string
}

export interface FileItem {
  file_id: string // uf_id
  file_name: string
  file_size: number
  mime_type: string
  is_enc: boolean
  has_thumbnail: boolean
  public: boolean
  created_at: string
}

export interface FileListResp {
  breadcrumbs: BreadcrumbItem[]
  current_path: string
  folders: FolderItem[]
  files: FileItem[]
  total: number
  page: number
  page_size: number
}

// ── 上传 ──────────────────────────────────────────────────────

export interface PrecheckReq {
  file_name: string
  file_size: number
  chunk_signature?: string
  path_id: string
  files_md5?: string[]
}

export interface PrecheckResp {
  precheck_id: string
  already_done: boolean
  uploaded_md5: string[]
}

export interface UploadResp {
  file_id: string
  is_complete: boolean
  uploaded?: number
  total?: number
}

// ── 文件操作 ──────────────────────────────────────────────────

export interface DeleteFilesResp {
  success: number
  failed: number
  errors?: string[]
}

// ── 回收站 ────────────────────────────────────────────────────

export interface RecycledItem {
  recycled_id: string
  file_id: string
  file_name: string
  file_size: number
  mime_type: string
  is_enc: boolean
  has_thumbnail: boolean
  deleted_at: string
}

export interface RecycledListResp {
  items: RecycledItem[]
  total: number
  page: number
  page_size: number
}

export interface EmptyResp {
  deleted: number
  failed: number
}
