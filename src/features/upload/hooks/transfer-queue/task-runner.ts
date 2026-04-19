import type { MutableRefObject } from 'react'

import type { TransferQueueTask } from '@/features/upload/transfer-queue-types'
import type { TaskSpeedTracker } from '@/features/upload/hooks/transfer-queue/speed-tracker'
import type { UpdateTaskPatch } from '@/features/upload/hooks/transfer-queue/task-patch'
import { getErrorMessage } from '@/lib/drive/api'
import { uploadFile } from '@/lib/drive/uploader'
import type { NameConflictAction, NameConflictPayload, ResumeState } from '@/lib/drive/upload/types'
import type { DriveFileRecord } from '@/lib/drive/types'

export type AbortIntent = 'pause' | 'cancel'

interface TransferTaskRunnerOptions {
  taskID: string
  getTaskByID: (taskID: string) => TransferQueueTask | null
  patchTask: (taskID: string, patch: UpdateTaskPatch) => void
  enqueueNameConflict: (taskID: string, payload: NameConflictPayload) => Promise<NameConflictAction>
  taskControllersRef: MutableRefObject<Map<string, AbortController>>
  taskAbortIntentRef: MutableRefObject<Map<string, AbortIntent>>
  launchingTaskIDsRef: MutableRefObject<Set<string>>
  speedTrackerRef: MutableRefObject<TaskSpeedTracker>
  onTaskFinalizeStartRef: MutableRefObject<((file: DriveFileRecord) => Promise<void> | void) | undefined>
  onTaskFinalizeAbortRef: MutableRefObject<((file: DriveFileRecord) => Promise<void> | void) | undefined>
  onTaskDoneRef: MutableRefObject<((file: DriveFileRecord) => Promise<void> | void) | undefined>
  multipartThreshold: number
  chunkSize: number
  multipartConcurrency?: number
}

function readResumeStateFromAbortError(error: unknown) {
  if (!(error instanceof DOMException) || error.name !== 'AbortError') {
    return undefined
  }

  const candidate = error as DOMException & { resumeState?: ResumeState | null }
  return candidate.resumeState
}

export async function runUploadTask({
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
  multipartThreshold,
  chunkSize,
  multipartConcurrency
}: TransferTaskRunnerOptions) {
  const task = getTaskByID(taskID)
  if (!task || task.status !== 'queued') {
    launchingTaskIDsRef.current.delete(taskID)
    return
  }

  const controller = new AbortController()
  taskControllersRef.current.set(taskID, controller)
  speedTrackerRef.current.beginTask(taskID, task.resumeState ? task.loadedBytes : 0)

  patchTask(taskID, {
    status: 'running',
    stage: 'checking',
    stageMessage: 'Preparing upload...',
    loadedBytes: task.resumeState ? task.loadedBytes : 0,
    totalBytes: task.fileSize,
    speedBytesPerSecond: 0,
    errorMessage: null
  })

  let optimisticFile: DriveFileRecord | null = null

  try {
    const result = await uploadFile({
      file: task.file,
      folderId: task.folderId,
      folderPath: task.folderPath,
      signal: controller.signal,
      multipartThreshold,
      chunkSize,
      multipartConcurrency,
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
        const speedBytesPerSecond = speedTrackerRef.current.sampleTask(taskID, progress.loaded)

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
    speedTrackerRef.current.clearTask(taskID)
    launchingTaskIDsRef.current.delete(taskID)
  }
}
