import type { TransferQueueTask } from '@/features/upload/transfer-queue-types'
import { normalizeFolderPath } from '@/lib/drive/path'

export function createTaskFingerprint(file: File, folderId: string) {
  return `${folderId}:${file.name}:${file.size}:${file.lastModified}`
}

export function createTaskFromFile(file: File, folderId: string, folderPath: string): TransferQueueTask {
  const normalizedFolderPath = normalizeFolderPath(folderPath)
  return {
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    fileSize: file.size,
    fileFingerprint: createTaskFingerprint(file, folderId),
    folderId,
    folderPath: normalizedFolderPath,
    createdAt: Date.now(),
    status: 'queued',
    stage: 'idle',
    stageMessage: 'Waiting to upload',
    loadedBytes: 0,
    totalBytes: file.size,
    speedBytesPerSecond: 0,
    percent: 0,
    strategy: 'pending',
    instantUpload: false,
    uploadedFile: null,
    errorMessage: null,
    resumeState: null
  }
}

export function buildQueuedTaskState(task: TransferQueueTask): TransferQueueTask {
  const hasResumeState = task.resumeState != null
  const retainedLoadedBytes = hasResumeState ? task.loadedBytes : 0
  return {
    ...task,
    status: 'queued',
    stage: 'idle',
    stageMessage: 'Waiting to upload',
    loadedBytes: retainedLoadedBytes,
    totalBytes: task.fileSize,
    speedBytesPerSecond: 0,
    strategy: 'pending',
    instantUpload: false,
    uploadedFile: null,
    errorMessage: null
  }
}
