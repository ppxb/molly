import type { TransferStage, TransferStrategy, DriveFileRecord } from '@/lib/drive/types'
import type { ResumeState } from '@/lib/drive/upload/types'

export type TransferQueueTaskStatus = 'queued' | 'running' | 'paused' | 'done' | 'error' | 'canceled'

export interface TransferQueueTask {
  id: string
  file: File
  fileName: string
  fileSize: number
  fileFingerprint: string
  folderId: string
  folderPath: string
  createdAt: number
  status: TransferQueueTaskStatus
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
