import type { TransferQueueTask } from '@/features/upload/transfer-queue-types'

export function pickQueuedTaskIDs(tasks: TransferQueueTask[], slots: number, launchingTaskIDs: Set<string>) {
  if (slots <= 0) {
    return []
  }

  const picked: string[] = []
  for (const task of tasks) {
    if (task.status !== 'queued') {
      continue
    }
    if (launchingTaskIDs.has(task.id)) {
      continue
    }

    picked.push(task.id)
    if (picked.length >= slots) {
      break
    }
  }
  return picked
}
