import type { UploadQueueOverview, UploadQueueTask } from '@/components/upload/upload-queue-types'

export function buildUploadQueueOverview(tasks: UploadQueueTask[], isQueueActive: boolean): UploadQueueOverview {
  let runningTasks = 0
  let queuedTasks = 0
  let doneTasks = 0
  let pausedTasks = 0
  let errorTasks = 0

  for (const task of tasks) {
    switch (task.status) {
      case 'running':
        runningTasks += 1
        break
      case 'queued':
        queuedTasks += 1
        break
      case 'done':
        doneTasks += 1
        break
      case 'paused':
        pausedTasks += 1
        break
      case 'error':
        errorTasks += 1
        break
      default:
        break
    }
  }

  const totalTasks = tasks.length
  const remainingTasks = queuedTasks + runningTasks + pausedTasks + errorTasks

  let overallStatusText = 'No upload tasks'
  if (totalTasks > 0) {
    if (runningTasks > 0) {
      overallStatusText = 'Uploading'
    } else if (remainingTasks === 0) {
      overallStatusText = 'All uploads completed'
    } else if (!isQueueActive || pausedTasks > 0) {
      overallStatusText = 'Uploads paused'
    } else if (errorTasks > 0 && queuedTasks === 0) {
      overallStatusText = 'Upload errors'
    } else if (queuedTasks > 0) {
      overallStatusText = 'Waiting to upload'
    } else {
      overallStatusText = 'Uploads paused'
    }
  }

  return {
    totalTasks,
    remainingTasks,
    runningTasks,
    queuedTasks,
    doneTasks,
    pausedTasks,
    overallStatusText
  }
}
