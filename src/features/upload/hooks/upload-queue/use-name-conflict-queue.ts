import { useCallback, useRef, useState } from 'react'

import type { UploadNameConflictAction, UploadNameConflictPayload } from '@/lib/drive/client/upload/types'

interface PendingNameConflict {
  taskID: string
  payload: UploadNameConflictPayload
  resolve: (action: UploadNameConflictAction) => void
}

export function useNameConflictQueue() {
  const queueRef = useRef<PendingNameConflict[]>([])
  const activeRef = useRef<PendingNameConflict | null>(null)
  const [activeNameConflict, setActiveNameConflict] = useState<UploadNameConflictPayload | null>(null)

  const activateNext = useCallback(() => {
    if (activeRef.current !== null) {
      return
    }

    const next = queueRef.current.shift()
    if (!next) {
      setActiveNameConflict(null)
      return
    }

    activeRef.current = next
    setActiveNameConflict(next.payload)
  }, [])

  const resolveActiveNameConflict = useCallback(
    (action: UploadNameConflictAction) => {
      const active = activeRef.current
      if (!active) {
        return
      }

      activeRef.current = null
      setActiveNameConflict(null)
      active.resolve(action)
      activateNext()
    },
    [activateNext]
  )

  const enqueueNameConflict = useCallback(
    (taskID: string, payload: UploadNameConflictPayload) =>
      new Promise<UploadNameConflictAction>(resolve => {
        queueRef.current.push({
          taskID,
          payload,
          resolve
        })
        activateNext()
      }),
    [activateNext]
  )

  const removeTaskConflicts = useCallback(
    (taskID: string) => {
      const active = activeRef.current
      if (active && active.taskID === taskID) {
        resolveActiveNameConflict('skip')
        return
      }

      const remaining: PendingNameConflict[] = []
      for (const conflict of queueRef.current) {
        if (conflict.taskID === taskID) {
          conflict.resolve('skip')
          continue
        }

        remaining.push(conflict)
      }
      queueRef.current = remaining
    },
    [resolveActiveNameConflict]
  )

  const clearAllConflicts = useCallback(() => {
    if (activeRef.current) {
      activeRef.current.resolve('skip')
      activeRef.current = null
    }

    for (const conflict of queueRef.current) {
      conflict.resolve('skip')
    }

    queueRef.current = []
    setActiveNameConflict(null)
  }, [])

  return {
    activeNameConflict,
    enqueueNameConflict,
    resolveActiveNameConflict,
    removeTaskConflicts,
    clearAllConflicts
  }
}
