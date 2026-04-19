import type { TransferQueueTask } from '@/features/upload/transfer-queue-types'

const DB_NAME = 'molly-upload-queue'
const DB_VERSION = 1
const STORE_NAME = 'state'
const STATE_KEY = 'queue'

type StoredTransferQueueState = {
  version: 1
  tasks: TransferQueueTask[]
  savedAt: number
}

function supportsIndexedDB() {
  return typeof indexedDB !== 'undefined'
}

function openDB() {
  if (!supportsIndexedDB()) {
    return Promise.resolve<IDBDatabase | null>(null)
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })
}

function toSafeTask(task: TransferQueueTask): TransferQueueTask | null {
  if (!(task.file instanceof File)) {
    return null
  }

  if (task.status === 'done' || task.status === 'canceled') {
    return null
  }

  const totalBytes = Math.max(1, task.fileSize)
  const loadedBytes = Math.min(Math.max(0, task.loadedBytes), totalBytes)
  const percent = Math.min(100, Math.max(0, (loadedBytes / totalBytes) * 100))
  const status = task.status === 'running' ? 'paused' : task.status

  return {
    ...task,
    status,
    stage: status === 'paused' ? 'idle' : task.stage,
    stageMessage: status === 'paused' ? 'Paused' : task.stageMessage,
    loadedBytes,
    totalBytes,
    percent,
    speedBytesPerSecond: 0
  }
}

export async function loadPersistedQueueTasks() {
  const db = await openDB()
  if (!db) {
    return [] as TransferQueueTask[]
  }

  try {
    const state = await new Promise<StoredTransferQueueState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.get(STATE_KEY)
      request.onsuccess = () => resolve((request.result as StoredTransferQueueState | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error('Failed to read queue state'))
    })

    if (!state || state.version !== 1 || !Array.isArray(state.tasks)) {
      return [] as TransferQueueTask[]
    }

    const restoredTasks: TransferQueueTask[] = []
    for (const task of state.tasks) {
      const safeTask = toSafeTask(task)
      if (!safeTask) {
        continue
      }
      restoredTasks.push(safeTask)
    }

    return restoredTasks
  } finally {
    db.close()
  }
}

export async function persistQueueTasks(tasks: TransferQueueTask[]) {
  const db = await openDB()
  if (!db) {
    return
  }

  try {
    const safeTasks = tasks.map(toSafeTask).filter((task): task is TransferQueueTask => task !== null)
    if (safeTasks.length === 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const request = store.delete(STATE_KEY)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error ?? new Error('Failed to clear queue state'))
      })
      return
    }

    const state: StoredTransferQueueState = {
      version: 1,
      tasks: safeTasks,
      savedAt: Date.now()
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(state, STATE_KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Failed to persist queue state'))
    })
  } finally {
    db.close()
  }
}

export async function clearPersistedQueueTasks() {
  const db = await openDB()
  if (!db) {
    return
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(STATE_KEY)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error ?? new Error('Failed to clear queue state'))
    })
  } finally {
    db.close()
  }
}
