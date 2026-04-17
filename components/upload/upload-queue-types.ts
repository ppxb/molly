import type { UploadStage, UploadStrategy, UploadedFileRecord } from '@/lib/upload/shared'

export type UploadQueueTaskStatus = 'queued' | 'running' | 'paused' | 'done' | 'error' | 'canceled'

export interface UploadQueueTask {
  id: string
  file: File
  fileName: string
  fileSize: number
  fileFingerprint: string
  folderPath: string
  createdAt: number
  status: UploadQueueTaskStatus
  stage: UploadStage
  stageMessage: string
  loadedBytes: number
  totalBytes: number
  percent: number
  strategy: UploadStrategy | 'pending'
  instantUpload: boolean
  uploadedFile: UploadedFileRecord | null
  errorMessage: string | null
}

export interface UploadQueueOverview {
  totalTasks: number
  remainingTasks: number
  runningTasks: number
  queuedTasks: number
  doneTasks: number
  pausedTasks: number
  overallStatusText: string
}
