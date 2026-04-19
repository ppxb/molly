import type { TransferQueueTask } from '@/features/upload/transfer-queue-types'
import type { TransferStage, TransferStrategy, DriveFileRecord } from '@/lib/drive/types'
import type { ResumeState } from '@/lib/drive/upload/types'

export interface UpdateTaskPatch {
  status?: TransferQueueTask['status']
  stage?: TransferStage
  stageMessage?: string
  loadedBytes?: number
  totalBytes?: number
  speedBytesPerSecond?: number
  strategy?: TransferStrategy | 'pending'
  instantUpload?: boolean
  uploadedFile?: DriveFileRecord | null
  errorMessage?: string | null
  resumeState?: ResumeState | null
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }
  return Math.min(100, Math.max(0, value))
}

export function applyTaskPatch(task: TransferQueueTask, patch: UpdateTaskPatch): TransferQueueTask {
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

export function buildPausedTaskState(task: TransferQueueTask): TransferQueueTask {
  return {
    ...task,
    status: 'paused',
    stage: 'idle',
    stageMessage: 'Paused',
    speedBytesPerSecond: 0,
    errorMessage: null
  }
}
