import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { FolderIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { UploadFabMenu } from '@/components/upload-fab-menu'
import { CreateFolderDialog } from '@/components/upload/create-folder-dialog'
import { DeleteForeverDialog } from '@/components/upload/delete-forever-dialog'
import { MoveEntryDialog } from '@/components/upload/move-entry-dialog'
import { RenameEntryDialog } from '@/components/upload/rename-entry-dialog'
import { TrashEntryDialog } from '@/components/upload/trash-entry-dialog'
import { UploadFloatingPanel } from '@/components/upload-floating-panel'
import { useUploadBrowserEntries } from '@/components/upload/hooks/use-upload-browser-entries'
import { useUploadEntryActions } from '@/components/upload/hooks/use-upload-entry-actions'
import { useUploadQueue } from '@/components/upload/hooks/use-upload-queue'
import { useUploadRecycleBinActions } from '@/components/upload/hooks/use-upload-recyclebin-actions'
import { useUploadRecycleBinEntries } from '@/components/upload/hooks/use-upload-recyclebin-entries'
import { UploadRecycleBinOverview } from '@/components/upload/upload-recyclebin-overview'
import { UploadNameConflictDialog } from '@/components/upload/upload-name-conflict-dialog'
import { UploadBrowserStoreProvider } from '@/components/upload/stores/upload-browser-store'
import { UploadedFilesOverview } from '@/components/upload/uploaded-files-overview'
import { getErrorMessage, getFileAccessUrlRequest } from '@/lib/upload/client/api'
import { scheduleHashWorkerPrewarm } from '@/lib/upload/client/hash'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '../toggle-theme'

function UploadDashboardContent() {
  const [activeView, setActiveView] = useState<'files' | 'recyclebin'>('files')

  const {
    currentFolderId,
    currentPath,
    breadcrumbs,
    folders,
    files,
    isLoadingEntries,
    isPanelVisible,
    setCurrentFolderId,
    setPanelVisible,
    currentFolderIdRef,
    currentPathRef,
    loadEntries,
    refreshCurrentPath
  } = useUploadBrowserEntries()
  const {
    folders: recycleFolders,
    files: recycleFiles,
    isLoadingRecycleBin,
    loadRecycleBinEntries,
    removeEntryOptimistic
  } = useUploadRecycleBinEntries()
  const {
    isRestoring,
    isDeletingForever,
    deleteForeverTarget,
    onRestoreFile,
    onRestoreFolder,
    onDeleteForeverFile,
    onDeleteForeverFolder,
    submitDeleteForever,
    onDeleteForeverDialogOpenChange
  } = useUploadRecycleBinActions({
    refresh: loadRecycleBinEntries,
    removeEntryOptimistic
  })

  const quickUploadInputRef = useRef<HTMLInputElement>(null)

  const {
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
  } = useUploadQueue({
    initialConcurrency: 3,
    onTaskDone: async file => {
      if (file.folderId === currentFolderIdRef.current) {
        await loadEntries(currentFolderIdRef.current)
      }
    }
  })

  const {
    isCreateFolderDialogOpen,
    setIsCreateFolderDialogOpen,
    isCreatingFolder,
    createFolder,
    renameTarget,
    isRenaming,
    submitRename,
    onRenameDialogOpenChange,
    onRenameFile,
    onRenameFolder,
    moveTarget,
    moveTargetFolders,
    isLoadingMoveTargets,
    isMoving,
    submitMove,
    onMoveDialogOpenChange,
    onMoveFile,
    onMoveFolder,
    trashTarget,
    isTrashing,
    submitTrash,
    onTrashDialogOpenChange,
    onTrashFile,
    onTrashFolder
  } = useUploadEntryActions({
    currentFolderId,
    currentFolderIdRef,
    loadEntries
  })

  useEffect(() => {
    if (activeView !== 'files') {
      return
    }
    void loadEntries(currentFolderId)
  }, [activeView, currentFolderId, loadEntries])

  useEffect(() => {
    if (activeView !== 'recyclebin') {
      return
    }
    void loadRecycleBinEntries()
  }, [activeView, loadRecycleBinEntries])

  useEffect(() => {
    scheduleHashWorkerPrewarm()
  }, [])

  useEffect(() => {
    if (tasks.length === 0) {
      setPanelVisible(false)
      return
    }
    setPanelVisible(true)
  }, [tasks.length, setPanelVisible])

  const openFileURL = useCallback(async (fileId: string, mode: 'preview' | 'download') => {
    try {
      const data = await getFileAccessUrlRequest({
        fileId,
        mode
      })
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to open file'))
    }
  }, [])

  const onQuickUploadChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? [])
      if (selectedFiles.length > 0) {
        addFiles(selectedFiles, {
          targetFolderId: currentFolderIdRef.current,
          targetFolderPath: currentPathRef.current
        })
        setPanelVisible(true)
      }
      event.target.value = ''
    },
    [addFiles, currentFolderIdRef, currentPathRef, setPanelVisible]
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <input ref={quickUploadInputRef} type="file" multiple className="hidden" onChange={onQuickUploadChange} />
      <ThemeToggle />
      <div className="mb-4 flex items-center gap-2">
        <Button
          type="button"
          variant={activeView === 'files' ? 'default' : 'outline'}
          onClick={() => setActiveView('files')}
        >
          <FolderIcon className="size-4" />
          My Files
        </Button>
        <Button
          type="button"
          variant={activeView === 'recyclebin' ? 'default' : 'outline'}
          onClick={() => setActiveView('recyclebin')}
        >
          <Trash2Icon className="size-4" />
          Recycle Bin
        </Button>
      </div>

      {activeView === 'files' ? (
        <>
          <UploadedFilesOverview
            currentFolderId={currentFolderId}
            breadcrumbs={breadcrumbs}
            folders={folders}
            files={files}
            isLoading={isLoadingEntries}
            onRefresh={refreshCurrentPath}
            onNavigate={setCurrentFolderId}
            onOpenFile={openFileURL}
            onUploadFiles={() => quickUploadInputRef.current?.click()}
            onCreateFolder={() => setIsCreateFolderDialogOpen(true)}
            onRenameFile={onRenameFile}
            onMoveFile={onMoveFile}
            onTrashFile={onTrashFile}
            onRenameFolder={onRenameFolder}
            onMoveFolder={onMoveFolder}
            onTrashFolder={onTrashFolder}
          />

          <UploadFabMenu
            currentPath={currentPath}
            onSelectFiles={selectedFiles => {
              addFiles(selectedFiles, {
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
            onOpenChange={onRenameDialogOpenChange}
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
            onOpenChange={onMoveDialogOpenChange}
            onConfirm={submitMove}
          />

          <TrashEntryDialog
            open={trashTarget !== null}
            isSubmitting={isTrashing}
            onOpenChange={onTrashDialogOpenChange}
            onConfirm={submitTrash}
          />

          <UploadNameConflictDialog
            open={activeNameConflict !== null}
            fileName={activeNameConflict?.fileName ?? ''}
            onOpenChange={open => {
              if (!open) {
                resolveActiveNameConflict('skip')
              }
            }}
            onSelect={resolveActiveNameConflict}
          />
        </>
      ) : (
        <>
          <UploadRecycleBinOverview
            folders={recycleFolders}
            files={recycleFiles}
            isLoading={isLoadingRecycleBin}
            isRestoring={isRestoring}
            onRefresh={() => {
              void loadRecycleBinEntries()
            }}
            onRestoreFile={onRestoreFile}
            onRestoreFolder={onRestoreFolder}
            onDeleteForeverFile={onDeleteForeverFile}
            onDeleteForeverFolder={onDeleteForeverFolder}
          />

          <DeleteForeverDialog
            open={deleteForeverTarget !== null}
            type={deleteForeverTarget?.type ?? 'file'}
            name={deleteForeverTarget?.name ?? ''}
            isSubmitting={isDeletingForever}
            onOpenChange={onDeleteForeverDialogOpenChange}
            onConfirm={submitDeleteForever}
          />
        </>
      )}

      {isPanelVisible ? (
        <UploadFloatingPanel
          tasks={tasks}
          overview={overview}
          onCancelAll={cancelAllTasks}
          onPauseAll={pauseAllTasks}
          onContinueAll={continueAllTasks}
          onCancelTask={cancelTask}
          onPauseTask={pauseTask}
          onContinueTask={continueTask}
          onRequestClose={() => {
            if (overview.remainingTasks === 0) {
              cancelAllTasks()
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
