import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { UploadFabMenu } from '@/components/upload-fab-menu'
import { CreateFolderDialog } from '@/components/upload/create-folder-dialog'
import { MoveEntryDialog } from '@/components/upload/move-entry-dialog'
import { RenameEntryDialog } from '@/components/upload/rename-entry-dialog'
import { UploadFloatingPanel } from '@/components/upload-floating-panel'
import { useUploadQueue } from '@/components/upload/hooks/use-upload-queue'
import { UploadBrowserStoreProvider, useUploadBrowserStore } from '@/components/upload/stores/upload-browser-store'
import { UploadedFilesOverview } from '@/components/upload/uploaded-files-overview'
import {
  createUploadFolderRequest,
  getFileAccessUrlRequest,
  getLatestAsyncTaskRequest,
  listUploadEntriesRequest,
  listUploadMoveTargetsRequest,
  updateFileRequest,
  uploadBatchRequest
} from '@/lib/upload/client/api'
import { scheduleHashWorkerPrewarm } from '@/lib/upload/client/hash'
import type { UploadFolderRecord } from '@/lib/upload/shared'
import { ThemeToggle } from '../toggle-theme'

interface RenameTarget {
  id: string
  type: 'file' | 'folder'
  name: string
}

interface MoveTarget {
  id: string
  type: 'file' | 'folder'
  name: string
  initialTargetFolderId: string
  excludeFolderId?: string
}

function UploadDashboardContent() {
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  const [moveTargetFolders, setMoveTargetFolders] = useState<UploadFolderRecord[]>([])
  const [isLoadingMoveTargets, setIsLoadingMoveTargets] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isMoving, setIsMoving] = useState(false)

  const currentFolderId = useUploadBrowserStore(state => state.currentFolderId)
  const currentPath = useUploadBrowserStore(state => state.currentPath)
  const breadcrumbs = useUploadBrowserStore(state => state.breadcrumbs)
  const folders = useUploadBrowserStore(state => state.folders)
  const files = useUploadBrowserStore(state => state.files)
  const isLoadingEntries = useUploadBrowserStore(state => state.isLoadingEntries)
  const isPanelVisible = useUploadBrowserStore(state => state.isPanelVisible)

  const setCurrentFolderId = useUploadBrowserStore(state => state.setCurrentFolderId)
  const setEntries = useUploadBrowserStore(state => state.setEntries)
  const setIsLoadingEntries = useUploadBrowserStore(state => state.setIsLoadingEntries)
  const setPanelVisible = useUploadBrowserStore(state => state.setPanelVisible)

  const currentFolderIdRef = useRef(currentFolderId)
  const currentPathRef = useRef(currentPath)
  const quickUploadInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    currentFolderIdRef.current = currentFolderId
  }, [currentFolderId])

  useEffect(() => {
    currentPathRef.current = currentPath
  }, [currentPath])

  const loadEntries = useCallback(
    async (folderId: string) => {
      setIsLoadingEntries(true)
      try {
        const data = await listUploadEntriesRequest(folderId)
        setEntries({
          folderId: data.folderId,
          path: data.path,
          breadcrumbs: data.breadcrumbs,
          files: data.files,
          folders: data.folders
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load folder contents')
      } finally {
        setIsLoadingEntries(false)
      }
    },
    [setEntries, setIsLoadingEntries]
  )

  const queue = useUploadQueue({
    initialConcurrency: 3,
    onTaskDone: async file => {
      if (file.folderId === currentFolderIdRef.current) {
        await loadEntries(currentFolderIdRef.current)
      }
    }
  })

  useEffect(() => {
    void loadEntries(currentFolderId)
  }, [currentFolderId, loadEntries])

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
      toast.error(error instanceof Error ? error.message : 'Failed to open file')
    }
  }, [])

  const createFolder = useCallback(
    async (folderName: string) => {
      const normalizedName = folderName.trim()
      if (!normalizedName) {
        toast.error('Folder name cannot be empty')
        return
      }

      setIsCreatingFolder(true)
      try {
        await createUploadFolderRequest({
          parentFolderId: currentFolderId,
          folderName: normalizedName
        })
        toast.success('Folder created')
        setIsCreateFolderDialogOpen(false)
        await loadEntries(currentFolderId)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to create folder')
      } finally {
        setIsCreatingFolder(false)
      }
    },
    [currentFolderId, loadEntries]
  )

  const refreshCurrentPath = useCallback(() => {
    void loadEntries(currentFolderId)
  }, [currentFolderId, loadEntries])

  const handleQuickUploadChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? [])
      if (selectedFiles.length > 0) {
        queue.addFiles(selectedFiles, {
          targetFolderId: currentFolderIdRef.current,
          targetFolderPath: currentPathRef.current
        })
        setPanelVisible(true)
      }
      event.target.value = ''
    },
    [queue, setPanelVisible]
  )

  const openMoveDialog = useCallback(async (target: MoveTarget) => {
    setMoveTarget(target)
    setMoveTargetFolders([])
    setIsLoadingMoveTargets(true)

    try {
      const data = await listUploadMoveTargetsRequest(
        target.type === 'folder' && target.excludeFolderId
          ? {
              excludeFolderId: target.excludeFolderId
            }
          : undefined
      )
      setMoveTargetFolders(data.folders)
    } catch (error) {
      setMoveTarget(null)
      toast.error(error instanceof Error ? error.message : 'Failed to load move targets')
    } finally {
      setIsLoadingMoveTargets(false)
    }
  }, [])

  const submitRename = useCallback(
    async (nextName: string) => {
      if (!renameTarget) {
        return
      }

      setIsRenaming(true)
      try {
        await updateFileRequest({
          file_id: renameTarget.id,
          name: nextName,
          check_name_mode: 'refuse'
        })
        toast.success(renameTarget.type === 'file' ? 'File renamed' : 'Folder renamed')

        setRenameTarget(null)
        await loadEntries(currentFolderIdRef.current)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to rename')
      } finally {
        setIsRenaming(false)
      }
    },
    [renameTarget, loadEntries]
  )

  const submitMove = useCallback(
    async (targetFolderId: string) => {
      if (!moveTarget) {
        return
      }

      setIsMoving(true)
      try {
        await getLatestAsyncTaskRequest()

        const batch = await uploadBatchRequest({
          resource: 'file',
          requests: [
            {
              id: moveTarget.id,
              method: 'POST',
              url: '/file/move',
              body: {
                file_id: moveTarget.id,
                file_name: moveTarget.name,
                type: moveTarget.type,
                to_parent_file_id: targetFolderId
              }
            }
          ]
        })

        const result = batch.responses[0]
        if (!result || result.status !== 200) {
          const body = result?.body
          const message =
            body && typeof body === 'object' && 'message' in body && typeof body['message'] === 'string'
              ? body['message']
              : 'Failed to move'
          throw new Error(message)
        }

        toast.success(moveTarget.type === 'file' ? 'File moved' : 'Folder moved')
        setMoveTarget(null)
        await loadEntries(currentFolderIdRef.current)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to move')
      } finally {
        setIsMoving(false)
      }
    },
    [moveTarget, loadEntries]
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <input ref={quickUploadInputRef} type="file" multiple className="hidden" onChange={handleQuickUploadChange} />
      <ThemeToggle />

      <UploadedFilesOverview
        currentFolderId={currentFolderId}
        breadcrumbs={breadcrumbs}
        folders={folders}
        files={files}
        isLoading={isLoadingEntries}
        onRefresh={refreshCurrentPath}
        onNavigate={setCurrentFolderId}
        onOpenFile={openFileUrl}
        onUploadFiles={() => quickUploadInputRef.current?.click()}
        onCreateFolder={() => setIsCreateFolderDialogOpen(true)}
        onRenameFile={file =>
          setRenameTarget({
            id: file.id,
            type: 'file',
            name: file.fileName
          })
        }
        onMoveFile={file => {
          void openMoveDialog({
            id: file.id,
            type: 'file',
            name: file.fileName,
            initialTargetFolderId: file.folderId
          })
        }}
        onRenameFolder={folder =>
          setRenameTarget({
            id: folder.id,
            type: 'folder',
            name: folder.folderName
          })
        }
        onMoveFolder={folder => {
          void openMoveDialog({
            id: folder.id,
            type: 'folder',
            name: folder.folderName,
            initialTargetFolderId: folder.parentId ?? 'root',
            excludeFolderId: folder.id
          })
        }}
      />

      <UploadFabMenu
        currentPath={currentPath}
        onSelectFiles={selectedFiles => {
          queue.addFiles(selectedFiles, {
            targetFolderId: currentFolderId,
            targetFolderPath: currentPath
          })
          setPanelVisible(true)
        }}
        onCreateFolder={() => setIsCreateFolderDialogOpen(true)}
      />

      <CreateFolderDialog
        open={isCreateFolderDialogOpen}
        currentPath={currentPath}
        isSubmitting={isCreatingFolder}
        onOpenChange={setIsCreateFolderDialogOpen}
        onConfirm={createFolder}
      />

      <RenameEntryDialog
        open={renameTarget !== null}
        type={renameTarget?.type ?? 'file'}
        currentName={renameTarget?.name ?? ''}
        isSubmitting={isRenaming}
        onOpenChange={open => {
          if (!open) {
            setRenameTarget(null)
          }
        }}
        onConfirm={submitRename}
      />

      <MoveEntryDialog
        open={moveTarget !== null}
        type={moveTarget?.type ?? 'file'}
        name={moveTarget?.name ?? ''}
        initialTargetFolderId={moveTarget?.initialTargetFolderId ?? 'root'}
        folders={moveTargetFolders}
        isLoadingTargets={isLoadingMoveTargets}
        isSubmitting={isMoving}
        onOpenChange={open => {
          if (!open) {
            setMoveTarget(null)
          }
        }}
        onConfirm={submitMove}
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
