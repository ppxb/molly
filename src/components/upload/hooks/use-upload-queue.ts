'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { UploadQueueOverview, UploadQueueTask } from '@/components/upload/upload-queue-types'
import { uploadRuntimeConfig } from '@/lib/upload/client/runtime-config'
import { uploadFile } from '@/lib/upload/client/uploader'
import { normalizeFolderPath } from '@/lib/upload/path'
import { DEFAULT_MULTIPART_CHUNK_SIZE, DEFAULT_MULTIPART_THRESHOLD } from '@/lib/upload/shared'
import type { UploadStage, UploadStrategy, UploadedFileRecord } from '@/lib/upload/shared'

interface UseUploadQueueOptions {
  initialConcurrency?: number
  onTaskDone?: (file: UploadedFileRecord) => Promise<void> | void
}

interface AddFilesOptions {
  targetFolderId?: string
  targetFolderPath?: string
}

interface UpdateTaskPatch {
  status?: UploadQueueTask['status']
  stage?: UploadStage
  stageMessage?: string
  loadedBytes?: number
  totalBytes?: number
  strategy?: UploadStrategy | 'pending'
  instantUpload?: boolean
  uploadedFile?: UploadedFileRecord | null
  errorMessage?: string | null
}

type AbortIntent = 'pause' | 'cancel'

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, value))
}

function createTaskFingerprint(file: File, folderId: string) {
  return `${folderId}:${file.name}:${file.size}:${file.lastModified}`
}

function createTaskFromFile(file: File, folderId: string, folderPath: string): UploadQueueTask {
  const normalizedFolderPath = normalizeFolderPath(folderPath)
  return {
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    fileSize: file.size,
    fileFingerprint: createTaskFingerprint(file, folderId),
    folderId,
    folderPath: normalizedFolderPath,
    createdAt: Date.now(),
    status: 'queued',
    stage: 'idle',
    stageMessage: 'Waiting to upload',
    loadedBytes: 0,
    totalBytes: file.size,
    percent: 0,
    strategy: 'pending',
    instantUpload: false,
    uploadedFile: null,
    errorMessage: null
  }
}

function buildQueuedTaskState(task: UploadQueueTask) {
  return {
    ...task,
    status: 'queued' as const,
    stage: 'idle' as const,
    stageMessage: 'Waiting to upload',
    loadedBytes: 0,
    totalBytes: task.fileSize,
    strategy: 'pending' as const,
    instantUpload: false,
    uploadedFile: null,
    errorMessage: null
  }
}

export function useUploadQueue(options: UseUploadQueueOptions = {}) {
  const [tasks, setTasks] = useState<UploadQueueTask[]>([])
  const [concurrency] = useState(Math.max(1, options.initialConcurrency ?? 3))
  const [isQueueActive, setIsQueueActive] = useState(false)

  const tasksRef = useRef<UploadQueueTask[]>([])
  const onTaskDoneRef = useRef(options.onTaskDone)
  const launchingTaskIdsRef = useRef<Set<string>>(new Set())
  const taskControllersRef = useRef<Map<string, AbortController>>(new Map())
  const taskAbortIntentRef = useRef<Map<string, AbortIntent>>(new Map())

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    onTaskDoneRef.current = options.onTaskDone
  }, [options.onTaskDone])

  const patchTask = useCallback((taskId: string, patch: UpdateTaskPatch) => {
    setTasks(previous =>
      previous.map(task => {
        if (task.id !== taskId) {
          return task
        }

        const totalBytes = patch.totalBytes ?? task.totalBytes
        const rawLoadedBytes = patch.loadedBytes ?? task.loadedBytes
        const loadedBytes =
          totalBytes > 0 ? Math.min(Math.max(0, rawLoadedBytes), totalBytes) : Math.max(0, rawLoadedBytes)
        const percent = clampPercent(totalBytes > 0 ? (loadedBytes / totalBytes) * 100 : 0)

        return {
          ...task,
          ...patch,
          loadedBytes,
          totalBytes,
          percent
        }
      })
    )
  }, [])

  const getTaskById = useCallback((taskId: string) => tasksRef.current.find(task => task.id === taskId) ?? null, [])

  const runTask = useCallback(
    async (taskId: string) => {
      const task = getTaskById(taskId)
      if (!task || task.status !== 'queued') {
        launchingTaskIdsRef.current.delete(taskId)
        return
      }

      const controller = new AbortController()
      taskControllersRef.current.set(taskId, controller)

      patchTask(taskId, {
        status: 'running',
        stage: 'checking',
        stageMessage: 'Preparing upload...',
        loadedBytes: 0,
        totalBytes: task.fileSize,
        errorMessage: null
      })

      try {
        const result = await uploadFile({
          file: task.file,
          folderId: task.folderId,
          folderPath: task.folderPath,
          signal: controller.signal,
          multipartThreshold: uploadRuntimeConfig.multipartThreshold ?? DEFAULT_MULTIPART_THRESHOLD,
          chunkSize: DEFAULT_MULTIPART_CHUNK_SIZE,
          multipartConcurrency: uploadRuntimeConfig.multipartConcurrency,
          onStageChange: (stage, stageMessage) => {
            patchTask(taskId, {
              stage,
              stageMessage
            })
          },
          onProgress: progress => {
            patchTask(taskId, {
              loadedBytes: progress.loaded,
              totalBytes: progress.total
            })
          }
        })

        patchTask(taskId, {
          status: 'done',
          stage: 'done',
          stageMessage: result.instantUpload ? 'Instant upload completed' : 'Upload completed',
          strategy: result.strategy,
          instantUpload: result.instantUpload,
          uploadedFile: result.file,
          loadedBytes: task.fileSize,
          totalBytes: task.fileSize,
          errorMessage: null
        })

        await onTaskDoneRef.current?.(result.file)
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === 'AbortError'
        const abortIntent = taskAbortIntentRef.current.get(taskId)

        if (isAbort && abortIntent === 'cancel') {
          return
        }

        if (isAbort && abortIntent === 'pause') {
          patchTask(taskId, {
            status: 'paused',
            stage: 'idle',
            stageMessage: 'Paused',
            errorMessage: null
          })
          return
        }

        patchTask(taskId, {
          status: isAbort ? 'paused' : 'error',
          stage: isAbort ? 'idle' : 'error',
          stageMessage: isAbort ? 'Paused' : error instanceof Error ? error.message : 'Upload failed',
          errorMessage: isAbort ? null : error instanceof Error ? error.message : 'Upload failed'
        })
      } finally {
        taskControllersRef.current.delete(taskId)
        taskAbortIntentRef.current.delete(taskId)
        launchingTaskIdsRef.current.delete(taskId)
      }
    },
    [getTaskById, patchTask]
  )

  useEffect(() => {
    if (!isQueueActive) {
      return
    }

    const runningCount = tasks.filter(task => task.status === 'running').length
    const launchingCount = launchingTaskIdsRef.current.size
    const slots = concurrency - runningCount - launchingCount
    if (slots <= 0) {
      return
    }

    const queuedTasks = tasks.filter(task => task.status === 'queued').slice(0, slots)
    for (const queuedTask of queuedTasks) {
      if (launchingTaskIdsRef.current.has(queuedTask.id)) {
        continue
      }

      launchingTaskIdsRef.current.add(queuedTask.id)
      void runTask(queuedTask.id)
    }
  }, [concurrency, isQueueActive, runTask, tasks])

  useEffect(() => {
    if (!isQueueActive) {
      return
    }

    const hasQueued = tasks.some(task => task.status === 'queued')
    const hasRunning = tasks.some(task => task.status === 'running') || launchingTaskIdsRef.current.size > 0
    if (!hasQueued && !hasRunning) {
      setIsQueueActive(false)
    }
  }, [isQueueActive, tasks])

  const addFiles = useCallback((incomingFiles: File[] | FileList, addOptions: AddFilesOptions = {}) => {
    const fileList = Array.isArray(incomingFiles) ? incomingFiles : Array.from(incomingFiles)
    if (fileList.length === 0) {
      return
    }

    const targetFolderId = addOptions.targetFolderId?.trim() || 'root'
    const targetFolderPath = normalizeFolderPath(addOptions.targetFolderPath ?? '')
    const existingFingerprints = new Set(tasksRef.current.map(task => task.fileFingerprint))
    const newTasks = fileList
      .filter(file => {
        const fingerprint = createTaskFingerprint(file, targetFolderId)
        if (existingFingerprints.has(fingerprint)) {
          return false
        }

        existingFingerprints.add(fingerprint)
        return true
      })
      .map(file => createTaskFromFile(file, targetFolderId, targetFolderPath))

    if (newTasks.length === 0) {
      return
    }

    setTasks(previous => previous.concat(newTasks))
    setIsQueueActive(true)
  }, [])

  const continueTask = useCallback(
    (taskId: string) => {
      const task = getTaskById(taskId)
      if (!task || task.status === 'running' || task.status === 'done') {
        return
      }

      patchTask(taskId, buildQueuedTaskState(task))
      setIsQueueActive(true)
    },
    [getTaskById, patchTask]
  )

  const pauseTask = useCallback(
    (taskId: string) => {
      const task = getTaskById(taskId)
      if (!task || task.status === 'done') {
        return
      }

      if (task.status === 'running') {
        const controller = taskControllersRef.current.get(taskId)
        if (controller) {
          taskAbortIntentRef.current.set(taskId, 'pause')
          controller.abort()
          return
        }
      }

      patchTask(taskId, {
        status: 'paused',
        stage: 'idle',
        stageMessage: 'Paused',
        errorMessage: null
      })
    },
    [getTaskById, patchTask]
  )

  const cancelTask = useCallback(
    (taskId: string) => {
      const task = getTaskById(taskId)
      if (!task) {
        return
      }

      if (task.status === 'running') {
        const controller = taskControllersRef.current.get(taskId)
        if (controller) {
          taskAbortIntentRef.current.set(taskId, 'cancel')
          controller.abort()
        }
      }

      setTasks(previous => previous.filter(item => item.id !== taskId))
    },
    [getTaskById]
  )

  const continueAllTasks = useCallback(() => {
    setTasks(previous => previous.map(task => (task.status === 'done' ? task : buildQueuedTaskState(task))))
    setIsQueueActive(true)
  }, [])

  const pauseAllTasks = useCallback(() => {
    setIsQueueActive(false)

    for (const [taskId, controller] of taskControllersRef.current.entries()) {
      taskAbortIntentRef.current.set(taskId, 'pause')
      controller.abort()
    }

    setTasks(previous =>
      previous.map(task => {
        if (task.status === 'done' || task.status === 'running') {
          return task
        }

        return {
          ...task,
          status: 'paused',
          stage: 'idle',
          stageMessage: 'Paused',
          errorMessage: null
        }
      })
    )
  }, [])

  const cancelAllTasks = useCallback(() => {
    setIsQueueActive(false)

    for (const [taskId, controller] of taskControllersRef.current.entries()) {
      taskAbortIntentRef.current.set(taskId, 'cancel')
      controller.abort()
    }

    launchingTaskIdsRef.current.clear()
    taskControllersRef.current.clear()
    taskAbortIntentRef.current.clear()
    setTasks([])
  }, [])

  const overview = useMemo<UploadQueueOverview>(() => {
    const totalTasks = tasks.length
    const runningTasks = tasks.filter(task => task.status === 'running').length
    const queuedTasks = tasks.filter(task => task.status === 'queued').length
    const doneTasks = tasks.filter(task => task.status === 'done').length
    const pausedTasks = tasks.filter(task => task.status === 'paused').length
    const errorTasks = tasks.filter(task => task.status === 'error').length
    const remainingTasks = tasks.filter(
      task =>
        task.status === 'queued' || task.status === 'running' || task.status === 'paused' || task.status === 'error'
    ).length

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
  }, [isQueueActive, tasks])

  return {
    tasks,
    overview,
    addFiles,
    cancelTask,
    pauseTask,
    continueTask,
    cancelAllTasks,
    pauseAllTasks,
    continueAllTasks
  }
}
