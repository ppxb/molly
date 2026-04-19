import type { TransferQueueOverview, TransferQueueTask } from '@/features/upload/transfer-queue-types'

export function buildTransferQueueOverview(tasks: TransferQueueTask[], isQueueActive: boolean): TransferQueueOverview {
  let runningTasks = 0
  let queuedTasks = 0
  let doneTasks = 0
  let pausedTasks = 0
  let errorTasks = 0
  let totalSpeedBytesPerSecond = 0

  for (const task of tasks) {
    switch (task.status) {
      case 'running':
        runningTasks += 1
        totalSpeedBytesPerSecond += Math.max(0, task.speedBytesPerSecond)
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
      overallStatusText = '正在上传'
    } else if (remainingTasks === 0) {
      overallStatusText = '上传完成'
    } else if (!isQueueActive || pausedTasks > 0) {
      overallStatusText = '上传已暂停'
    } else if (errorTasks > 0 && queuedTasks === 0) {
      overallStatusText = '上传错误'
    } else if (queuedTasks > 0) {
      overallStatusText = '等待上传'
    } else {
      overallStatusText = '上传已暂停'
    }
  }

  return {
    totalTasks,
    remainingTasks,
    runningTasks,
    queuedTasks,
    doneTasks,
    pausedTasks,
    totalSpeedBytesPerSecond,
    overallStatusText
  }
}
