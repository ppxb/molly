import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useUploadQueue } from '@/components/upload/hooks/use-upload-queue'
import { useUploadRecycleBinActions } from '@/components/upload/hooks/use-upload-recyclebin-actions'
import { useUploadRecycleBinEntries } from '@/components/upload/hooks/use-upload-recyclebin-entries'
import { UploadDashboardTabs, type UploadDashboardView } from '@/components/upload/upload-dashboard-tabs'
import { UploadPanelSection } from '@/components/upload/upload-panel-section'
import { UploadBrowserStoreProvider } from '@/components/upload/stores/upload-browser-store'
import { FilesSection, RecycleBinSection, useEntryActions, useFileBrowser } from '@/features/file-browser'
import { getErrorMessage, getFileAccessUrlRequest } from '@/lib/upload/client/api'
import { scheduleHashWorkerPrewarm } from '@/lib/upload/client/hash'

import { ThemeToggle } from '../toggle-theme'

function UploadDashboardContent() {
  const [activeView, setActiveView] = useState<UploadDashboardView>('files')
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
      <UploadDashboardTabs activeView={activeView} onChange={setActiveView} />

      {activeView === 'files' ? (
        <FilesSection
          currentPath={currentPath}
          onSelectFiles={selectedFiles => {
            addFiles(selectedFiles, {
              targetFolderId: currentFolderId,
              targetFolderPath: currentPath
            })
            setPanelVisible(true)
          }}
          onCreateFolder={() => setIsCreateFolderDialogOpen(true)}
          browser={{
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
      ) : (
        <RecycleBinSection
          folders={recycleFolders}
          files={recycleFiles}
          isLoading={isLoadingRecycleBin}
          isRestoring={isRestoring}
          isDeletingForever={isDeletingForever}
          isClearing={isClearing}
          isClearDialogOpen={isClearDialogOpen}
          deleteForeverTarget={deleteForeverTarget}
          onRefresh={() => {
            void loadRecycleBinEntries()
          }}
          onClear={onClearRecycleBin}
          onRestoreFile={onRestoreFile}
          onRestoreFolder={onRestoreFolder}
          onDeleteForeverFile={onDeleteForeverFile}
          onDeleteForeverFolder={onDeleteForeverFolder}
          onDeleteForeverDialogOpenChange={onDeleteForeverDialogOpenChange}
          onConfirmDeleteForever={submitDeleteForever}
          onClearDialogOpenChange={onClearDialogOpenChange}
          onConfirmClear={submitClearRecycleBin}
        />
      )}

      <UploadPanelSection
        isVisible={isPanelVisible}
        tasks={tasks}
        overview={overview}
        onCancelAll={cancelAllTasks}
        onPauseAll={pauseAllTasks}
        onContinueAll={continueAllTasks}
        onCancelTask={cancelTask}
        onPauseTask={pauseTask}
        onContinueTask={continueTask}
        onClose={() => {
          if (overview.remainingTasks === 0) {
            cancelAllTasks()
            setPanelVisible(false)
          }
        }}
      />
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
