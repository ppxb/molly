import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import type { UploadQueueTask } from '@/features/upload/upload-queue-types'
import {
  clearPersistedQueueTasks,
  loadPersistedQueueTasks,
  persistQueueTasks
} from '@/features/upload/hooks/upload-queue/persistence'

const QUEUE_PERSIST_INTERVAL_MS = 1200

interface UseQueuePersistenceInput {
  tasks: UploadQueueTask[]
  setTasks: Dispatch<SetStateAction<UploadQueueTask[]>>
}

export function useQueuePersistence({ tasks, setTasks }: UseQueuePersistenceInput) {
  const [isQueueHydrated, setIsQueueHydrated] = useState(false)
  const persistTimerRef = useRef<number | null>(null)

  useEffect(() => {
    let active = true

    void loadPersistedQueueTasks()
      .then(restoredTasks => {
        if (!active || restoredTasks.length === 0) {
          return
        }

        setTasks(restoredTasks)
      })
      .finally(() => {
        if (active) {
          setIsQueueHydrated(true)
        }
      })

    return () => {
      active = false
    }
  }, [setTasks])

  useEffect(() => {
    if (!isQueueHydrated) {
      return
    }

    if (persistTimerRef.current !== null) {
      window.clearTimeout(persistTimerRef.current)
      persistTimerRef.current = null
    }

    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null
      if (tasks.length === 0) {
        void clearPersistedQueueTasks()
        return
      }

      void persistQueueTasks(tasks)
    }, QUEUE_PERSIST_INTERVAL_MS)

    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
    }
  }, [isQueueHydrated, tasks])

  return {
    isQueueHydrated
  }
}
