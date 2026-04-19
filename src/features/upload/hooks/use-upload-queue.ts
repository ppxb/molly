import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { UploadQueueTask } from '@/features/upload/upload-queue-types'
import { buildUploadQueueOverview } from '@/features/upload/hooks/upload-queue/overview'
import { pickQueuedTaskIDs } from '@/features/upload/hooks/upload-queue/scheduling'
import { createTaskSpeedTracker } from '@/features/upload/hooks/upload-queue/speed-tracker'
import { runUploadTask, type AbortIntent } from '@/features/upload/hooks/upload-queue/task-runner'
import {
  buildPausedTaskState,
  type UpdateTaskPatch,
  applyTaskPatch
} from '@/features/upload/hooks/upload-queue/task-patch'
import {
  buildQueuedTaskState,
  createTaskFingerprint,
  createTaskFromFile
} from '@/features/upload/hooks/upload-queue/task-factory'
import { useLatestRef } from '@/features/upload/hooks/upload-queue/use-latest-ref'
import { useNameConflictQueue } from '@/features/upload/hooks/upload-queue/use-name-conflict-queue'
import { useQueuePersistence } from '@/features/upload/hooks/upload-queue/use-queue-persistence'
import { uploadRuntimeConfig } from '@/lib/drive/client/runtime-config'
import { normalizeFolderPath } from '@/lib/drive/path'
import { DEFAULT_MULTIPART_CHUNK_SIZE, DEFAULT_MULTIPART_THRESHOLD } from '@/lib/drive/shared'
import type { UploadedFileRecord } from '@/lib/drive/shared'

interface UseUploadQueueOptions {
  initialConcurrency?: number
  onTaskFinalizeStart?: (file: UploadedFileRecord) => Promise<void> | void
  onTaskFinalizeAbort?: (file: UploadedFileRecord) => Promise<void> | void
  onTaskDone?: (file: UploadedFileRecord) => Promise<void> | void
}

interface AddFilesOptions {
  targetFolderId?: string
  targetFolderPath?: string
}

export function useUploadQueue(options: UseUploadQueueOptions = {}) {
  const [tasks, setTasks] = useState<UploadQueueTask[]>([])
  const [concurrency] = useState(Math.max(1, options.initialConcurrency ?? 3))
  const [isQueueActive, setIsQueueActive] = useState(false)

  const tasksRef = useLatestRef(tasks)
  const onTaskFinalizeStartRef = useLatestRef(options.onTaskFinalizeStart)
  const onTaskFinalizeAbortRef = useLatestRef(options.onTaskFinalizeAbort)
  const onTaskDoneRef = useLatestRef(options.onTaskDone)
  const launchingTaskIDsRef = useRef<Set<string>>(new Set())
  const taskControllersRef = useRef<Map<string, AbortController>>(new Map())
  const taskAbortIntentRef = useRef<Map<string, AbortIntent>>(new Map())
  const speedTrackerRef = useRef(createTaskSpeedTracker())

  useQueuePersistence({
    tasks,
    setTasks
  })

  const { activeNameConflict, enqueueNameConflict, resolveActiveNameConflict, removeTaskConflicts, clearAllConflicts } =
    useNameConflictQueue()

  const patchTask = useCallback((taskID: string, patch: UpdateTaskPatch) => {
    setTasks(previous =>
      previous.map(task => {
        if (task.id !== taskID) {
          return task
        }

        return applyTaskPatch(task, patch)
      })
    )
  }, [])

  const getTaskByID = useCallback(
    (taskID: string) => tasksRef.current.find(task => task.id === taskID) ?? null,
    [tasksRef]
  )

  const runTask = useCallback(
    async (taskID: string) =>
      runUploadTask({
        taskID,
        getTaskByID,
        patchTask,
        enqueueNameConflict,
        taskControllersRef,
        taskAbortIntentRef,
        launchingTaskIDsRef,
        speedTrackerRef,
        onTaskFinalizeStartRef,
        onTaskFinalizeAbortRef,
        onTaskDoneRef,
        multipartThreshold: uploadRuntimeConfig.multipartThreshold ?? DEFAULT_MULTIPART_THRESHOLD,
        chunkSize: DEFAULT_MULTIPART_CHUNK_SIZE,
        multipartConcurrency: uploadRuntimeConfig.multipartConcurrency
      }),
    [enqueueNameConflict, getTaskByID, onTaskDoneRef, onTaskFinalizeAbortRef, onTaskFinalizeStartRef, patchTask]
  )

  useEffect(() => {
    if (!isQueueActive) {
      return
    }

    const runningCount = tasks.filter(task => task.status === 'running').length
    const launchingCount = launchingTaskIDsRef.current.size
    const slots = concurrency - runningCount - launchingCount
    if (slots <= 0) {
      return
    }

    const taskIDsToStart = pickQueuedTaskIDs(tasks, slots, launchingTaskIDsRef.current)
    for (const taskID of taskIDsToStart) {
      launchingTaskIDsRef.current.add(taskID)
      void runTask(taskID)
    }
  }, [concurrency, isQueueActive, runTask, tasks])

  useEffect(() => {
    if (!isQueueActive) {
      return
    }

    const hasQueued = tasks.some(task => task.status === 'queued')
    const hasRunning = tasks.some(task => task.status === 'running') || launchingTaskIDsRef.current.size > 0
    if (!hasQueued && !hasRunning) {
      setIsQueueActive(false)
    }
  }, [isQueueActive, tasks])

  const addFiles = useCallback(
    (incomingFiles: File[] | FileList, addOptions: AddFilesOptions = {}) => {
      const fileList = Array.isArray(incomingFiles) ? incomingFiles : Array.from(incomingFiles)
      if (fileList.length === 0) {
        return
      }

      const targetFolderID = addOptions.targetFolderId?.trim() || 'root'
      const targetFolderPath = normalizeFolderPath(addOptions.targetFolderPath ?? '')
      const existingFingerprints = new Set(tasksRef.current.map(task => task.fileFingerprint))

      const newTasks = fileList
        .filter(file => {
          const fingerprint = createTaskFingerprint(file, targetFolderID)
          if (existingFingerprints.has(fingerprint)) {
            return false
          }

          existingFingerprints.add(fingerprint)
          return true
        })
        .map(file => createTaskFromFile(file, targetFolderID, targetFolderPath))

      if (newTasks.length === 0) {
        return
      }

      setTasks(previous => previous.concat(newTasks))
      setIsQueueActive(true)
    },
    [tasksRef]
  )

  const continueTask = useCallback(
    (taskID: string) => {
      const task = getTaskByID(taskID)
      if (!task || task.status === 'running' || task.status === 'done') {
        return
      }

      patchTask(taskID, buildQueuedTaskState(task))
      setIsQueueActive(true)
    },
    [getTaskByID, patchTask]
  )

  const pauseTask = useCallback(
    (taskID: string) => {
      const task = getTaskByID(taskID)
      if (!task || task.status === 'done') {
        return
      }

      if (task.status === 'running') {
        const controller = taskControllersRef.current.get(taskID)
        if (controller) {
          taskAbortIntentRef.current.set(taskID, 'pause')
          controller.abort()
          return
        }
      }

      patchTask(taskID, {
        status: 'paused',
        stage: 'idle',
        stageMessage: 'Paused',
        errorMessage: null
      })
    },
    [getTaskByID, patchTask]
  )

  const cancelTask = useCallback(
    (taskID: string) => {
      const task = getTaskByID(taskID)
      if (!task) {
        return
      }

      if (task.status === 'running') {
        const controller = taskControllersRef.current.get(taskID)
        if (controller) {
          taskAbortIntentRef.current.set(taskID, 'cancel')
          controller.abort()
        }
      }

      removeTaskConflicts(taskID)
      speedTrackerRef.current.clearTask(taskID)
      setTasks(previous => previous.filter(item => item.id !== taskID))
    },
    [getTaskByID, removeTaskConflicts]
  )

  const continueAllTasks = useCallback(() => {
    setTasks(previous => previous.map(task => (task.status === 'done' ? task : buildQueuedTaskState(task))))
    setIsQueueActive(true)
  }, [])

  const pauseAllTasks = useCallback(() => {
    setIsQueueActive(false)

    for (const [taskID, controller] of taskControllersRef.current.entries()) {
      taskAbortIntentRef.current.set(taskID, 'pause')
      controller.abort()
    }

    setTasks(previous =>
      previous.map(task => {
        if (task.status === 'done' || task.status === 'running') {
          return task
        }

        return buildPausedTaskState(task)
      })
    )
  }, [])

  const cancelAllTasks = useCallback(() => {
    setIsQueueActive(false)

    for (const [taskID, controller] of taskControllersRef.current.entries()) {
      taskAbortIntentRef.current.set(taskID, 'cancel')
      controller.abort()
    }

    launchingTaskIDsRef.current.clear()
    taskControllersRef.current.clear()
    taskAbortIntentRef.current.clear()
    clearAllConflicts()
    speedTrackerRef.current.clearAll()
    setTasks([])
  }, [clearAllConflicts])

  const overview = useMemo(() => buildUploadQueueOverview(tasks, isQueueActive), [isQueueActive, tasks])

  return {
    tasks,
    overview,
    addFiles,
    cancelTask,
    pauseTask,
    continueTask,
    cancelAllTasks,
    pauseAllTasks,
    continueAllTasks,
    activeNameConflict,
    resolveActiveNameConflict
  }
}
