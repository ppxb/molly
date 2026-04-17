import { UploadQueueTask } from '@/components/upload/upload-queue-types'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unitIndex = 0

  while (bytes >= 1024 && unitIndex < units.length - 1) {
    bytes /= 1024
    unitIndex += 1
  }

  return `${unitIndex === 0 ? bytes : bytes.toFixed(2)} ${units[unitIndex]}`
}

const STATUS_TEXT: Partial<Record<UploadQueueTask['status'], string>> = {
  queued: '等待上传',
  running: '上传中',
  paused: '已暂停',
  done: '上传完成',
  error: '上传失败'
}

export function getTaskStatusText(task: UploadQueueTask) {
  if (task.stageMessage.trim()) {
    return task.stageMessage
  }

  return STATUS_TEXT[task.status] ?? '等待上传'
}
