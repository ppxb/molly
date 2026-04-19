import type { UploadQueueTask } from '@/components/upload/upload-queue-types'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unitIndex = 0
  let size = Math.max(0, bytes)

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${unitIndex === 0 ? size : size.toFixed(2)} ${units[unitIndex]}`
}

const STATUS_TEXT: Partial<Record<UploadQueueTask['status'], string>> = {
  queued: 'Waiting',
  running: 'Uploading',
  paused: 'Paused',
  done: 'Completed',
  error: 'Failed'
}

export function getTaskStatusText(task: UploadQueueTask) {
  if (task.stageMessage.trim()) {
    return task.stageMessage
  }

  return STATUS_TEXT[task.status] ?? 'Waiting'
}

const formatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
})

export function formatDateTime(iso: string) {
  return iso ? formatter.format(new Date(iso)) : '-'
}
