import type { UploadStage, UploadStrategy, UploadedFileRecord } from '@/lib/upload/shared'

export interface UploadProgressPayload {
  loaded: number
  total: number
  percent: number
}

export interface UploadCallbacks {
  onStageChange?: (stage: UploadStage, message: string) => void
  onProgress?: (progress: UploadProgressPayload) => void
}

export interface UploadFileInput extends UploadCallbacks {
  file: File
  folderId?: string
  folderPath?: string
  signal?: AbortSignal
  multipartThreshold?: number
  chunkSize?: number
  multipartConcurrency?: number
}

export interface UploadFileResult {
  file: UploadedFileRecord
  strategy: UploadStrategy
  instantUpload: boolean
}
