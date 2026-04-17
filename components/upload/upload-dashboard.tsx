'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useUploadQueue } from '@/components/upload/hooks/use-upload-queue'
import { UploadFabMenu } from '@/components/upload-fab-menu'
import { UploadFloatingPanel } from '@/components/upload-floating-panel'
import { UploadedFilesOverview } from '@/components/upload/uploaded-files-overview'
import { getFileAccessUrlRequest, listUploadedFilesRequest } from '@/lib/upload/client/api'
import { scheduleHashWorkerPrewarm } from '@/lib/upload/client/hash'
import type { UploadedFileRecord } from '@/lib/upload/shared'
import { ThemeToggle } from '../toggle-theme'

export function UploadDashboard() {
  const [files, setFiles] = useState<UploadedFileRecord[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [isPanelVisible, setIsPanelVisible] = useState(false)

  const loadFiles = useCallback(async () => {
    setIsLoadingFiles(true)
    try {
      const data = await listUploadedFilesRequest()
      setFiles(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载文件列表失败')
    } finally {
      setIsLoadingFiles(false)
    }
  }, [])

  const queue = useUploadQueue({
    initialConcurrency: 3,
    onTaskDone: async () => {
      await loadFiles()
    }
  })

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  useEffect(() => {
    scheduleHashWorkerPrewarm()
  }, [])

  useEffect(() => {
    if (queue.tasks.length === 0) {
      setIsPanelVisible(false)
    }
  }, [queue.tasks.length])

  const openFileUrl = useCallback(async (fileId: string, mode: 'preview' | 'download') => {
    try {
      const data = await getFileAccessUrlRequest({
        fileId,
        mode
      })
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '打开文件失败')
    }
  }, [])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <ThemeToggle />
      <UploadedFilesOverview files={files} isLoading={isLoadingFiles} onRefresh={loadFiles} onOpenFile={openFileUrl} />

      <UploadFabMenu
        onSelectFiles={files => {
          queue.addFiles(files)
          setIsPanelVisible(true)
        }}
      />
      {isPanelVisible ? (
        <UploadFloatingPanel
          tasks={queue.tasks}
          overview={queue.overview}
          onCancelAll={queue.cancelAllTasks}
          onPauseAll={queue.pauseAllTasks}
          onContinueAll={queue.continueAllTasks}
          onCancelTask={queue.cancelTask}
          onPauseTask={queue.pauseTask}
          onContinueTask={queue.continueTask}
          onRequestClose={() => {
            if (queue.overview.remainingTasks === 0) {
              queue.cancelAllTasks()
              setIsPanelVisible(false)
            }
          }}
        />
      ) : null}
    </div>
  )
}
