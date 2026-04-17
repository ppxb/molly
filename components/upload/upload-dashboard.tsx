'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { UploadFabMenu } from '@/components/upload-fab-menu'
import { CreateFolderDialog } from '@/components/upload/create-folder-dialog'
import { UploadFloatingPanel } from '@/components/upload-floating-panel'
import { useUploadQueue } from '@/components/upload/hooks/use-upload-queue'
import { UploadBrowserStoreProvider, useUploadBrowserStore } from '@/components/upload/stores/upload-browser-store'
import { UploadedFilesOverview } from '@/components/upload/uploaded-files-overview'
import { createUploadFolderRequest, getFileAccessUrlRequest, listUploadEntriesRequest } from '@/lib/upload/client/api'
import { scheduleHashWorkerPrewarm } from '@/lib/upload/client/hash'
import { normalizeFolderPath } from '@/lib/upload/path'
import { ThemeToggle } from '../toggle-theme'

function UploadDashboardContent() {
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)

  const currentPath = useUploadBrowserStore(state => state.currentPath)
  const folders = useUploadBrowserStore(state => state.folders)
  const files = useUploadBrowserStore(state => state.files)
  const isLoadingEntries = useUploadBrowserStore(state => state.isLoadingEntries)
  const isPanelVisible = useUploadBrowserStore(state => state.isPanelVisible)

  const setCurrentPath = useUploadBrowserStore(state => state.setCurrentPath)
  const setEntries = useUploadBrowserStore(state => state.setEntries)
  const setIsLoadingEntries = useUploadBrowserStore(state => state.setIsLoadingEntries)
  const setPanelVisible = useUploadBrowserStore(state => state.setPanelVisible)

  const currentPathRef = useRef(currentPath)
  useEffect(() => {
    currentPathRef.current = currentPath
  }, [currentPath])

  const loadEntries = useCallback(
    async (path: string) => {
      setIsLoadingEntries(true)
      try {
        const normalizedPath = normalizeFolderPath(path)
        const data = await listUploadEntriesRequest(normalizedPath)
        setEntries({
          files: data.files,
          folders: data.folders
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '加载目录内容失败')
      } finally {
        setIsLoadingEntries(false)
      }
    },
    [setEntries, setIsLoadingEntries]
  )

  const queue = useUploadQueue({
    initialConcurrency: 3,
    onTaskDone: async file => {
      if (file.folderPath === currentPathRef.current) {
        await loadEntries(currentPathRef.current)
      }
    }
  })

  useEffect(() => {
    void loadEntries(currentPath)
  }, [currentPath, loadEntries])

  useEffect(() => {
    scheduleHashWorkerPrewarm()
  }, [])

  useEffect(() => {
    if (queue.tasks.length === 0) {
      setPanelVisible(false)
    }
  }, [queue.tasks.length, setPanelVisible])

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

  const createFolder = useCallback(
    async (folderName: string) => {
      const normalizedName = folderName.trim()
      if (!normalizedName) {
        toast.error('文件夹名称不能为空')
        return
      }

      setIsCreatingFolder(true)
      try {
        await createUploadFolderRequest({
          parentPath: currentPath,
          folderName: normalizedName
        })
        toast.success('文件夹创建成功')
        setIsCreateFolderDialogOpen(false)
        await loadEntries(currentPath)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '创建文件夹失败')
      } finally {
        setIsCreatingFolder(false)
      }
    },
    [currentPath, loadEntries]
  )

  const refreshCurrentPath = useCallback(() => {
    void loadEntries(currentPath)
  }, [currentPath, loadEntries])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <ThemeToggle />
      <UploadedFilesOverview
        currentPath={currentPath}
        folders={folders}
        files={files}
        isLoading={isLoadingEntries}
        onRefresh={refreshCurrentPath}
        onNavigate={setCurrentPath}
        onOpenFile={openFileUrl}
      />

      <UploadFabMenu
        currentPath={currentPath}
        onSelectFiles={selectedFiles => {
          queue.addFiles(selectedFiles, {
            targetFolderPath: currentPath
          })
          setPanelVisible(true)
        }}
        onCreateFolder={() => {
          setIsCreateFolderDialogOpen(true)
        }}
      />

      <CreateFolderDialog
        open={isCreateFolderDialogOpen}
        currentPath={currentPath}
        isSubmitting={isCreatingFolder}
        onOpenChange={setIsCreateFolderDialogOpen}
        onConfirm={createFolder}
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
              setPanelVisible(false)
            }
          }}
        />
      ) : null}
    </div>
  )
}

export function UploadDashboard() {
  return (
    <UploadBrowserStoreProvider>
      <UploadDashboardContent />
    </UploadBrowserStoreProvider>
  )
}
