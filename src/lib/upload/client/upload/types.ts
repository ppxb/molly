import type { UploadStage, UploadStrategy, UploadedFileRecord } from '@/lib/upload/shared'

export interface UploadProgressPayload {
  loaded: number
  total: number
  percent: number
}

export interface UploadCallbacks {
  onStageChange?: (stage: UploadStage, message: string) => void
  onProgress?: (progress: UploadProgressPayload) => void
  onResumeStateChange?: (resumeState: UploadResumeState | null) => void
  onBeforeComplete?: (file: UploadedFileRecord) => void
  onNameConflict?: (payload: UploadNameConflictPayload) => Promise<UploadNameConflictAction> | UploadNameConflictAction
}

export interface UploadResumeState {
  uploadId: string
  fileId: string
  chunkSize: number
  totalParts: number
  completedPartNumbers: number[]
}

export type UploadNameConflictAction = 'skip' | 'overwrite' | 'keep_both'

export interface UploadNameConflictPayload {
  fileName: string
  folderId: string
  existingFileId: string
  existingFileName: string
}

export interface UploadFileInput extends UploadCallbacks {
  file: File
  folderId?: string
  folderPath?: string
  signal?: AbortSignal
  multipartThreshold?: number
  chunkSize?: number
  multipartConcurrency?: number
  resumeState?: UploadResumeState | null
}

export interface UploadFileResult {
  file: UploadedFileRecord
  strategy: UploadStrategy
  instantUpload: boolean
}
