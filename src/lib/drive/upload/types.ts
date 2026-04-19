import type { TransferStage, TransferStrategy, DriveFileRecord } from '@/lib/drive/types'

export interface TransferProgressPayload {
  loaded: number
  total: number
  percent: number
}

export interface TransferCallbacks {
  onStageChange?: (stage: TransferStage, message: string) => void
  onProgress?: (progress: TransferProgressPayload) => void
  onResumeStateChange?: (resumeState: ResumeState | null) => void
  onBeforeComplete?: (file: DriveFileRecord) => void
  onNameConflict?: (payload: NameConflictPayload) => Promise<NameConflictAction> | NameConflictAction
}

export interface ResumeState {
  uploadId: string
  fileId: string
  chunkSize: number
  totalParts: number
  completedPartNumbers: number[]
}

export type NameConflictAction = 'skip' | 'overwrite' | 'keep_both'

export interface NameConflictPayload {
  fileName: string
  folderId: string
  existingFileId: string
  existingFileName: string
}

export interface TransferFileInput extends TransferCallbacks {
  file: File
  folderId?: string
  folderPath?: string
  signal?: AbortSignal
  multipartThreshold?: number
  chunkSize?: number
  multipartConcurrency?: number
  resumeState?: ResumeState | null
}

export interface TransferFileResult {
  file: DriveFileRecord
  strategy: TransferStrategy
  instantUpload: boolean
}
