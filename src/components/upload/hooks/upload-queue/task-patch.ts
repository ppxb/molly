import type { UploadQueueTask } from '@/components/upload/upload-queue-types'
import type { UploadStage, UploadStrategy, UploadedFileRecord } from '@/lib/upload/shared'

export interface UpdateTaskPatch {
  status?: UploadQueueTask['status']
  stage?: UploadStage
  stageMessage?: string
  loadedBytes?: number
  totalBytes?: number
  speedBytesPerSecond?: number
  strategy?: UploadStrategy | 'pending'
  instantUpload?: boolean
  uploadedFile?: UploadedFileRecord | null
  errorMessage?: string | null
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(100, Math.max(0, value))
}

export function applyTaskPatch(task: UploadQueueTask, patch: UpdateTaskPatch): UploadQueueTask {
  const totalBytes = patch.totalBytes ?? task.totalBytes
  const rawLoadedBytes = patch.loadedBytes ?? task.loadedBytes
  const loadedBytes = totalBytes > 0 ? Math.min(Math.max(0, rawLoadedBytes), totalBytes) : Math.max(0, rawLoadedBytes)
  const percent = clampPercent(totalBytes > 0 ? (loadedBytes / totalBytes) * 100 : 0)

  return {
    ...task,
    ...patch,
    loadedBytes,
    totalBytes,
    percent
  }
}

export function buildPausedTaskState(task: UploadQueueTask): UploadQueueTask {
  return {
    ...task,
    status: 'paused',
    stage: 'idle',
    stageMessage: 'Paused',
    speedBytesPerSecond: 0,
    errorMessage: null
  }
}
