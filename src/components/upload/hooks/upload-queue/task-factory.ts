import type { UploadQueueTask } from '@/components/upload/upload-queue-types'
import { normalizeFolderPath } from '@/lib/upload/path'

export function createTaskFingerprint(file: File, folderId: string) {
  return `${folderId}:${file.name}:${file.size}:${file.lastModified}`
}

export function createTaskFromFile(file: File, folderId: string, folderPath: string): UploadQueueTask {
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
    percent: 0,
    strategy: 'pending',
    instantUpload: false,
    uploadedFile: null,
    errorMessage: null
  }
}

export function buildQueuedTaskState(task: UploadQueueTask): UploadQueueTask {
  return {
    ...task,
    status: 'queued',
    stage: 'idle',
    stageMessage: 'Waiting to upload',
    loadedBytes: 0,
    totalBytes: task.fileSize,
    strategy: 'pending',
    instantUpload: false,
    uploadedFile: null,
    errorMessage: null
  }
}
