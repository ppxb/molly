import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { FolderIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { UploadFabMenu } from '@/components/upload-fab-menu'
import { ClearRecycleBinDialog } from '@/components/upload/clear-recyclebin-dialog'
import { DeleteForeverDialog } from '@/components/upload/delete-forever-dialog'
import { useUploadQueue } from '@/components/upload/hooks/use-upload-queue'
import { useUploadRecycleBinActions } from '@/components/upload/hooks/use-upload-recyclebin-actions'
import { useUploadRecycleBinEntries } from '@/components/upload/hooks/use-upload-recyclebin-entries'
import { UploadRecycleBinOverview } from '@/components/upload/upload-recyclebin-overview'
import { UploadBrowserStoreProvider } from '@/components/upload/stores/upload-browser-store'
import { UploadFloatingPanel } from '@/components/upload-floating-panel'
import { Button } from '@/components/ui/button'
import { FileBrowser, useEntryActions, useFileBrowser } from '@/features/file-browser'
import { getErrorMessage, getFileAccessUrlRequest } from '@/lib/upload/client/api'
import { scheduleHashWorkerPrewarm } from '@/lib/upload/client/hash'

import { ThemeToggle } from '../toggle-theme'

function UploadDashboardContent() {
  const [activeView, setActiveView] = useState<'files' | 'recyclebin'>('files')
  const quickUploadInputRef = useRef<HTMLInputElement>(null)

  const {
    currentFolderId,
    currentPath,
    breadcrumbs,
    folders,
    files,
    isLoadingEntries,
    isPanelVisible,
    orderBy,
    orderDirection,
    viewMode,
    setCurrentFolderId,
    setListOrderBy,
    setListOrderDirection,
    setPanelVisible,
    setViewMode,
    currentFolderIdRef,
    currentPathRef,
    loadEntries,
    refreshCurrentPath,
    upsertFileInCurrentFolder,
    removeFileFromCurrentFolder
  } = useFileBrowser()

  const {
    folders: recycleFolders,
    files: recycleFiles,
    isLoadingRecycleBin,
    loadRecycleBinEntries,
    removeEntryOptimistic,
    clearAllOptimistic
  } = useUploadRecycleBinEntries()

  const {
    isRestoring,
    isDeletingForever,
    isClearing,
    isClearDialogOpen,
    deleteForeverTarget,
    onRestoreFile,
    onRestoreFolder,
    onDeleteForeverFile,
    onDeleteForeverFolder,
    onClearRecycleBin,
    submitDeleteForever,
    submitClearRecycleBin,
    onDeleteForeverDialogOpenChange,
    onClearDialogOpenChange
  } = useUploadRecycleBinActions({
    refresh: loadRecycleBinEntries,
    removeEntryOptimistic,
    clearAllOptimistic
  })

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
    onTaskFinalizeStart: file => {
      upsertFileInCurrentFolder(file)
    },
    onTaskFinalizeAbort: file => {
      removeFileFromCurrentFolder(file.id, file.folderId)
    },
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
    onTrashFolder,
    detailsTarget,
    isLoadingDetailsSummary,
    folderDetailsSummary,
    onDetailsDialogOpenChange,
    onViewDetailsFile,
    onViewDetailsFolder
  } = useEntryActions({
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
    setPanelVisible(tasks.length > 0)
  }, [setPanelVisible, tasks.length])

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
          鍏ㄩ儴鏂囦欢
        </Button>
        <Button
          type="button"
          variant={activeView === 'recyclebin' ? 'default' : 'outline'}
          onClick={() => setActiveView('recyclebin')}
        >
          <Trash2Icon className="size-4" />
          鍥炴敹绔?
        </Button>
      </div>

      {activeView === 'files' ? (
        <>
          <FileBrowser
            view={{
              currentFolderId,
              breadcrumbs,
              folders,
              files,
              isLoading: isLoadingEntries,
              orderBy,
              orderDirection,
              viewMode,
              onRefresh: refreshCurrentPath,
              onChangeOrderBy: setListOrderBy,
              onChangeOrderDirection: setListOrderDirection,
              onChangeViewMode: setViewMode,
              onNavigate: setCurrentFolderId,
              onOpenFile: openFileURL,
              onUploadFiles: () => quickUploadInputRef.current?.click(),
              onCreateFolder: () => setIsCreateFolderDialogOpen(true),
              onRenameFile,
              onMoveFile,
              onViewDetailsFile,
              onTrashFile,
              onRenameFolder,
              onMoveFolder,
              onViewDetailsFolder,
              onTrashFolder
            }}
            dialogs={{
              currentPath,
              isCreateFolderDialogOpen,
              setIsCreateFolderDialogOpen,
              isCreatingFolder,
              createFolder,
              renameTarget,
              isRenaming,
              submitRename,
              onRenameDialogOpenChange,
              moveTarget,
              moveTargetFolders,
              isLoadingMoveTargets,
              isMoving,
              submitMove,
              onMoveDialogOpenChange,
              trashTarget,
              isTrashing,
              submitTrash,
              onTrashDialogOpenChange,
              detailsTarget,
              isLoadingDetailsSummary,
              folderDetailsSummary,
              onDetailsDialogOpenChange,
              activeNameConflict,
              resolveActiveNameConflict
            }}
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
        </>
      ) : (
        <>
          <UploadRecycleBinOverview
            folders={recycleFolders}
            files={recycleFiles}
            isLoading={isLoadingRecycleBin}
            isRestoring={isRestoring}
            isClearing={isClearing}
            onRefresh={() => {
              void loadRecycleBinEntries()
            }}
            onClear={onClearRecycleBin}
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

          <ClearRecycleBinDialog
            open={isClearDialogOpen}
            isSubmitting={isClearing}
            onOpenChange={onClearDialogOpenChange}
            onConfirm={submitClearRecycleBin}
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
