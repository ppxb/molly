import type { TransferStage, TransferStrategy, DriveFileRecord } from '@/types/drive'

export type TransferTaskStatus = 'queued' | 'running' | 'paused' | 'done' | 'error' | 'canceled'

export interface TransferTask {
  id: string
  file: File
  fileName: string
  fileSize: number
  fileFingerprint: string
  folderId: string
  folderPath: string
  createdAt: number
  status: TransferTaskStatus
  stage: TransferStage
  stageMessage: string
  loadedBytes: number
  totalBytes: number
  speedBytesPerSecond: number
  percent: number
  strategy: TransferStrategy | 'pending'
  instantUpload: boolean
  uploadedFile: DriveFileRecord | null
  errorMessage: string | null
  resumeState: ResumeState | null
}

export interface TransferQueueOverview {
  totalTasks: number
  remainingTasks: number
  runningTasks: number
  queuedTasks: number
  doneTasks: number
  pausedTasks: number
  totalSpeedBytesPerSecond: number
  overallStatusText: string
}

export interface TransferProgress {
  loaded: number
  total: number
  percent: number
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

export interface UploadFileInput {
  file: File
  folderId?: string
  folderPath?: string
  signal?: AbortSignal
  multipartThreshold?: number
  chunkSize?: number
  multipartConcurrency?: number
  resumeState?: ResumeState | null
  onStageChange?: (stage: TransferStage, message: string) => void
  onProgress?: (progress: TransferProgress) => void
  onResumeStateChange?: (state: ResumeState | null) => void
  onBeforeComplete?: (file: DriveFileRecord) => void
  onNameConflict?: (payload: NameConflictPayload) => Promise<NameConflictAction> | NameConflictAction
}

export interface UploadFileResult {
  file: DriveFileRecord
  strategy: TransferStrategy
  instantUpload: boolean
}
