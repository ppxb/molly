import type { UploadQueueTask } from '@/components/upload/upload-queue-types'

export function getTaskStatusText(task: UploadQueueTask) {
  if (task.stageMessage.trim().length > 0) {
    return task.stageMessage
  }

  switch (task.status) {
    case 'queued':
      return '等待上传'
    case 'running':
      return '上传中'
    case 'paused':
      return '已暂停'
    case 'done':
      return '上传完成'
    case 'error':
      return '上传失败'
    default:
      return '等待上传'
  }
}
