import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { UploadQueueTask } from '@/features/upload/upload-queue-types'
import { buildUploadQueueOverview } from '@/features/upload/hooks/upload-queue/overview'
import {
  clearPersistedQueueTasks,
  loadPersistedQueueTasks,
  persistQueueTasks
} from '@/features/upload/hooks/upload-queue/persistence'
import { pickQueuedTaskIDs } from '@/features/upload/hooks/upload-queue/scheduling'
import {
  applyTaskPatch,
  buildPausedTaskState,
  type UpdateTaskPatch
} from '@/features/upload/hooks/upload-queue/task-patch'
import {
  buildQueuedTaskState,
  createTaskFingerprint,
  createTaskFromFile
} from '@/features/upload/hooks/upload-queue/task-factory'
import { getErrorMessage } from '@/lib/upload/client/api'
import { uploadRuntimeConfig } from '@/lib/upload/client/runtime-config'
import { uploadFile } from '@/lib/upload/client/uploader'
import type {
  UploadNameConflictAction,
  UploadNameConflictPayload,
  UploadResumeState
} from '@/lib/upload/client/upload/types'
import { normalizeFolderPath } from '@/lib/upload/path'
import { DEFAULT_MULTIPART_CHUNK_SIZE, DEFAULT_MULTIPART_THRESHOLD } from '@/lib/upload/shared'
import type { UploadedFileRecord } from '@/lib/upload/shared'

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

type AbortIntent = 'pause' | 'cancel'
const SPEED_SAMPLE_INTERVAL_MS = 250
const SPEED_SMOOTHING_WEIGHT = 0.25
const QUEUE_PERSIST_INTERVAL_MS = 1200

function readResumeStateFromAbortError(error: unknown) {
  if (!(error instanceof DOMException) || error.name !== 'AbortError') {
    return undefined
  }

  const candidate = error as DOMException & { resumeState?: UploadResumeState | null }
  return candidate.resumeState
}

export function useUploadQueue(options: UseUploadQueueOptions = {}) {
  const [tasks, setTasks] = useState<UploadQueueTask[]>([])
  const [concurrency] = useState(Math.max(1, options.initialConcurrency ?? 3))
  const [isQueueActive, setIsQueueActive] = useState(false)
  const [isQueueHydrated, setIsQueueHydrated] = useState(false)

  const tasksRef = useRef<UploadQueueTask[]>([])
  const onTaskFinalizeStartRef = useRef(options.onTaskFinalizeStart)
  const onTaskFinalizeAbortRef = useRef(options.onTaskFinalizeAbort)
  const onTaskDoneRef = useRef(options.onTaskDone)
  const launchingTaskIDsRef = useRef<Set<string>>(new Set())
  const taskControllersRef = useRef<Map<string, AbortController>>(new Map())
  const taskAbortIntentRef = useRef<Map<string, AbortIntent>>(new Map())
  const nameConflictQueueRef = useRef<
    Array<{ taskID: string; payload: UploadNameConflictPayload; resolve: (action: UploadNameConflictAction) => void }>
  >([])
  const activeNameConflictRef = useRef<{
    taskID: string
    payload: UploadNameConflictPayload
    resolve: (action: UploadNameConflictAction) => void
  } | null>(null)
  const queuePersistTimerRef = useRef<number | null>(null)
  const taskSpeedSampleRef = useRef<
    Map<string, { sampledLoadedBytes: number; sampledAtMS: number; speedBytesPerSecond: number }>
  >(new Map())
  const [activeNameConflict, setActiveNameConflict] = useState<UploadNameConflictPayload | null>(null)

  useEffect(() => {
    let active = true

    void loadPersistedQueueTasks()
      .then(restoredTasks => {
        if (!active) {
          return
        }
        if (restoredTasks.length > 0) {
          setTasks(restoredTasks)
        }
      })
      .finally(() => {
        if (!active) {
          return
        }
        setIsQueueHydrated(true)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isQueueHydrated) {
      return
    }

    if (queuePersistTimerRef.current !== null) {
      window.clearTimeout(queuePersistTimerRef.current)
      queuePersistTimerRef.current = null
    }

    queuePersistTimerRef.current = window.setTimeout(() => {
      queuePersistTimerRef.current = null
      if (tasks.length === 0) {
        void clearPersistedQueueTasks()
        return
      }
      void persistQueueTasks(tasks)
    }, QUEUE_PERSIST_INTERVAL_MS)

    return () => {
      if (queuePersistTimerRef.current !== null) {
        window.clearTimeout(queuePersistTimerRef.current)
        queuePersistTimerRef.current = null
      }
    }
  }, [isQueueHydrated, tasks])

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    onTaskFinalizeStartRef.current = options.onTaskFinalizeStart
  }, [options.onTaskFinalizeStart])

  useEffect(() => {
    onTaskFinalizeAbortRef.current = options.onTaskFinalizeAbort
  }, [options.onTaskFinalizeAbort])

  useEffect(() => {
    onTaskDoneRef.current = options.onTaskDone
  }, [options.onTaskDone])

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

  const getTaskByID = useCallback((taskID: string) => tasksRef.current.find(task => task.id === taskID) ?? null, [])

  const activateNextNameConflict = useCallback(() => {
    if (activeNameConflictRef.current !== null) {
      return
    }

    const next = nameConflictQueueRef.current.shift()
    if (!next) {
      setActiveNameConflict(null)
      return
    }

    activeNameConflictRef.current = next
    setActiveNameConflict(next.payload)
  }, [])

  const resolveActiveNameConflict = useCallback(
    (action: UploadNameConflictAction) => {
      const active = activeNameConflictRef.current
      if (!active) {
        return
      }

      activeNameConflictRef.current = null
      setActiveNameConflict(null)
      active.resolve(action)
      activateNextNameConflict()
    },
    [activateNextNameConflict]
  )

  const enqueueNameConflict = useCallback(
    (taskID: string, payload: UploadNameConflictPayload) =>
      new Promise<UploadNameConflictAction>(resolve => {
        nameConflictQueueRef.current.push({
          taskID,
          payload,
          resolve
        })
        activateNextNameConflict()
      }),
    [activateNextNameConflict]
  )

  const runTask = useCallback(
    async (taskID: string) => {
      const task = getTaskByID(taskID)
      if (!task || task.status !== 'queued') {
        launchingTaskIDsRef.current.delete(taskID)
        return
      }

      const controller = new AbortController()
      taskControllersRef.current.set(taskID, controller)
      taskSpeedSampleRef.current.set(taskID, {
        sampledLoadedBytes: 0,
        sampledAtMS: performance.now(),
        speedBytesPerSecond: 0
      })

      patchTask(taskID, {
        status: 'running',
        stage: 'checking',
        stageMessage: 'Preparing upload...',
        loadedBytes: task.resumeState ? task.loadedBytes : 0,
        totalBytes: task.fileSize,
        speedBytesPerSecond: 0,
        errorMessage: null
      })

      let optimisticFile: UploadedFileRecord | null = null

      try {
        const result = await uploadFile({
          file: task.file,
          folderId: task.folderId,
          folderPath: task.folderPath,
          signal: controller.signal,
          multipartThreshold: uploadRuntimeConfig.multipartThreshold ?? DEFAULT_MULTIPART_THRESHOLD,
          chunkSize: DEFAULT_MULTIPART_CHUNK_SIZE,
          multipartConcurrency: uploadRuntimeConfig.multipartConcurrency,
          resumeState: task.resumeState,
          onResumeStateChange: resumeState => {
            patchTask(taskID, {
              resumeState
            })
          },
          onNameConflict: async payload => {
            patchTask(taskID, {
              stage: 'checking',
              stageMessage: 'Waiting for duplicate-file action...'
            })
            return enqueueNameConflict(taskID, payload)
          },
          onBeforeComplete: file => {
            optimisticFile = file
            patchTask(taskID, {
              uploadedFile: file
            })
            void onTaskFinalizeStartRef.current?.(file)
          },
          onStageChange: (stage, stageMessage) => {
            const stagePatch: UpdateTaskPatch = {
              stage,
              stageMessage
            }
            if (stage !== 'uploading') {
              stagePatch.speedBytesPerSecond = 0
            }
            patchTask(taskID, stagePatch)
          },
          onProgress: progress => {
            const nowMS = performance.now()
            const previousSample = taskSpeedSampleRef.current.get(taskID)

            let speedBytesPerSecond = 0
            if (previousSample) {
              const deltaMS = Math.max(0, nowMS - previousSample.sampledAtMS)
              const shouldResample = deltaMS >= SPEED_SAMPLE_INTERVAL_MS || progress.loaded >= progress.total

              if (shouldResample) {
                const deltaBytes = Math.max(0, progress.loaded - previousSample.sampledLoadedBytes)
                const deltaSeconds = deltaMS / 1000
                const instantSpeed = deltaSeconds > 0 ? deltaBytes / deltaSeconds : 0
                speedBytesPerSecond =
                  previousSample.speedBytesPerSecond > 0
                    ? previousSample.speedBytesPerSecond * (1 - SPEED_SMOOTHING_WEIGHT) +
                      instantSpeed * SPEED_SMOOTHING_WEIGHT
                    : instantSpeed

                taskSpeedSampleRef.current.set(taskID, {
                  sampledLoadedBytes: progress.loaded,
                  sampledAtMS: nowMS,
                  speedBytesPerSecond
                })
              } else {
                speedBytesPerSecond = previousSample.speedBytesPerSecond
              }
            } else {
              taskSpeedSampleRef.current.set(taskID, {
                sampledLoadedBytes: progress.loaded,
                sampledAtMS: nowMS,
                speedBytesPerSecond: 0
              })
            }

            patchTask(taskID, {
              loadedBytes: progress.loaded,
              totalBytes: progress.total,
              speedBytesPerSecond
            })
          }
        })

        patchTask(taskID, {
          status: 'done',
          stage: 'done',
          stageMessage: result.instantUpload ? '秒传完成' : '上传完成',
          strategy: result.strategy,
          instantUpload: result.instantUpload,
          uploadedFile: result.file,
          loadedBytes: task.fileSize,
          totalBytes: task.fileSize,
          speedBytesPerSecond: 0,
          errorMessage: null,
          resumeState: null
        })

        await onTaskDoneRef.current?.(result.file)
      } catch (error) {
        if (optimisticFile) {
          void onTaskFinalizeAbortRef.current?.(optimisticFile)
          optimisticFile = null
        }

        const isAbort = error instanceof DOMException && error.name === 'AbortError'
        const abortIntent = taskAbortIntentRef.current.get(taskID)
        const failureMessage = getErrorMessage(error, 'Upload failed')
        const resumeState = readResumeStateFromAbortError(error)

        if (isAbort && abortIntent === 'cancel') {
          return
        }

        if (isAbort && abortIntent === 'pause') {
          patchTask(taskID, {
            status: 'paused',
            stage: 'idle',
            stageMessage: 'Paused',
            speedBytesPerSecond: 0,
            errorMessage: null,
            resumeState: resumeState ?? task.resumeState
          })
          return
        }

        patchTask(taskID, {
          status: isAbort ? 'paused' : 'error',
          stage: isAbort ? 'idle' : 'error',
          stageMessage: isAbort ? 'Paused' : failureMessage,
          speedBytesPerSecond: 0,
          errorMessage: isAbort ? null : failureMessage,
          resumeState: resumeState ?? task.resumeState
        })
      } finally {
        taskControllersRef.current.delete(taskID)
        taskAbortIntentRef.current.delete(taskID)
        taskSpeedSampleRef.current.delete(taskID)
        launchingTaskIDsRef.current.delete(taskID)
      }
    },
    [enqueueNameConflict, getTaskByID, patchTask]
  )

  useEffect(() => {
    if (!isQueueActive) {
      return
    }

    let runningCount = 0
    for (const task of tasks) {
      if (task.status === 'running') {
        runningCount += 1
      }
    }

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

  const addFiles = useCallback((incomingFiles: File[] | FileList, addOptions: AddFilesOptions = {}) => {
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
  }, [])

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

      const activeConflict = activeNameConflictRef.current
      if (activeConflict && activeConflict.taskID === taskID) {
        resolveActiveNameConflict('skip')
      } else {
        const keptConflicts = [] as typeof nameConflictQueueRef.current
        for (const item of nameConflictQueueRef.current) {
          if (item.taskID === taskID) {
            item.resolve('skip')
            continue
          }
          keptConflicts.push(item)
        }
        nameConflictQueueRef.current = keptConflicts
      }

      taskSpeedSampleRef.current.delete(taskID)
      setTasks(previous => previous.filter(item => item.id !== taskID))
    },
    [getTaskByID, resolveActiveNameConflict]
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
    if (activeNameConflictRef.current !== null) {
      activeNameConflictRef.current.resolve('skip')
      activeNameConflictRef.current = null
    }
    for (const item of nameConflictQueueRef.current) {
      item.resolve('skip')
    }
    nameConflictQueueRef.current = []
    setActiveNameConflict(null)
    taskSpeedSampleRef.current.clear()
    setTasks([])
  }, [])

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
