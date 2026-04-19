import {
  type ChangeEvent,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { toast } from 'sonner'

import {
  FileBrowserStoreProvider,
  useFileBrowser,
  useItemActions,
  type FileBrowserDialogsProps,
  type FileBrowserViewProps
} from '@/features/file-browser'
import { useRecycleBinActions } from '@/features/file-browser/hooks/use-recycle-bin-actions'
import { useRecycleBinEntries } from '@/features/file-browser/hooks/use-recycle-bin-entries'
import { useTransferQueue } from '@/features/upload/hooks/use-transfer-queue'
import { getErrorMessage, getFileAccessUrlRequest } from '@/lib/drive/api'
import { scheduleHashWorkerPrewarm } from '@/lib/drive/hash'

export type FilesWorkspaceView = 'files' | 'recyclebin'

interface FilesSectionState {
  onSelectFiles: (files: File[]) => void
  onCreateFolder: () => void
  browser: FileBrowserViewProps
  dialogs: FileBrowserDialogsProps
}

interface DeleteForeverTarget {
  type: 'file' | 'folder'
  name: string
}

interface RecycleBinSectionState {
  folders: ReturnType<typeof useRecycleBinEntries>['folders']
  files: ReturnType<typeof useRecycleBinEntries>['files']
  isLoading: boolean
  isRestoring: boolean
  isDeletingForever: boolean
  isClearing: boolean
  isClearDialogOpen: boolean
  deleteForeverTarget: DeleteForeverTarget | null
  onRefresh: () => void
  onClear: () => void
  onRestoreFile: ReturnType<typeof useRecycleBinActions>['onRestoreFile']
  onRestoreFolder: ReturnType<typeof useRecycleBinActions>['onRestoreFolder']
  onDeleteForeverFile: ReturnType<typeof useRecycleBinActions>['onDeleteForeverFile']
  onDeleteForeverFolder: ReturnType<typeof useRecycleBinActions>['onDeleteForeverFolder']
  onDeleteForeverDialogOpenChange: (open: boolean) => void
  onConfirmDeleteForever: () => Promise<void>
  onClearDialogOpenChange: (open: boolean) => void
  onConfirmClear: () => Promise<void>
}

interface TransferPanelState {
  isVisible: boolean
  tasks: ReturnType<typeof useTransferQueue>['tasks']
  overview: ReturnType<typeof useTransferQueue>['overview']
  onCancelAll: () => void
  onPauseAll: () => void
  onContinueAll: () => void
  onCancelTask: (taskId: string) => void
  onPauseTask: (taskId: string) => void
  onContinueTask: (taskId: string) => void
  onClose: () => void
}

interface FilesWorkspaceContextValue {
  activeView: FilesWorkspaceView
  setActiveView: (view: FilesWorkspaceView) => void
  filesSection: FilesSectionState
  recycleBinSection: RecycleBinSectionState
  transferPanel: TransferPanelState
}

const FilesWorkspaceContext = createContext<FilesWorkspaceContextValue | null>(null)

function FilesWorkspaceProviderInner({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<FilesWorkspaceView>('files')
  const filePickerInputRef = useRef<HTMLInputElement>(null)

  const browser = useFileBrowser()
  const recycleBinEntries = useRecycleBinEntries()
  const recycleBinActions = useRecycleBinActions({
    refresh: recycleBinEntries.loadRecycleBinEntries,
    removeItemOptimistic: recycleBinEntries.removeItemOptimistic,
    clearAllOptimistic: recycleBinEntries.clearAllOptimistic
  })

  const transferQueue = useTransferQueue({
    initialConcurrency: 3,
    onTaskFinalizeStart: file => {
      browser.upsertFileInCurrentFolder(file)
    },
    onTaskFinalizeAbort: file => {
      browser.removeFileFromCurrentFolder(file.id, file.folderId)
    },
    onTaskDone: async file => {
      if (file.folderId === browser.currentFolderIdRef.current) {
        await browser.loadEntries(browser.currentFolderIdRef.current)
      }
    }
  })

  const itemActions = useItemActions({
    loadEntries: browser.loadEntries
  })

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
    refreshCurrentPath
  } = browser

  const { loadRecycleBinEntries, folders: recycleFolders, files: recycleFiles, isLoadingRecycleBin } = recycleBinEntries

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
  } = transferQueue

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

  const selectFiles = useCallback(
    (selectedFiles: File[]) => {
      if (selectedFiles.length === 0) {
        return
      }

      addFiles(selectedFiles, {
        targetFolderId: currentFolderIdRef.current,
        targetFolderPath: currentPathRef.current
      })
      setPanelVisible(true)
    },
    [addFiles, currentFolderIdRef, currentPathRef, setPanelVisible]
  )

  const openFilePicker = useCallback(() => {
    filePickerInputRef.current?.click()
  }, [])

  const onFilePickerChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      selectFiles(Array.from(event.target.files ?? []))
      event.target.value = ''
    },
    [selectFiles]
  )

  const filesSection = useMemo<FilesSectionState>(
    () => ({
      onSelectFiles: selectFiles,
      onCreateFolder: () => itemActions.setIsCreateFolderDialogOpen(true),
      browser: {
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
        onAddFiles: openFilePicker,
        onCreateFolder: () => itemActions.setIsCreateFolderDialogOpen(true),
        onRenameFile: itemActions.onRenameFile,
        onMoveFile: itemActions.onMoveFile,
        onViewDetailsFile: itemActions.onViewDetailsFile,
        onTrashFile: itemActions.onTrashFile,
        onRenameFolder: itemActions.onRenameFolder,
        onMoveFolder: itemActions.onMoveFolder,
        onViewDetailsFolder: itemActions.onViewDetailsFolder,
        onTrashFolder: itemActions.onTrashFolder
      },
      dialogs: {
        currentPath,
        isCreateFolderDialogOpen: itemActions.isCreateFolderDialogOpen,
        setIsCreateFolderDialogOpen: itemActions.setIsCreateFolderDialogOpen,
        isCreatingFolder: itemActions.isCreatingFolder,
        createFolder: itemActions.createFolder,
        renameTarget: itemActions.renameTarget,
        isRenaming: itemActions.isRenaming,
        submitRename: itemActions.submitRename,
        onRenameDialogOpenChange: itemActions.onRenameDialogOpenChange,
        moveTarget: itemActions.moveTarget,
        moveTargetFolders: itemActions.moveTargetFolders,
        isLoadingMoveTargets: itemActions.isLoadingMoveTargets,
        isMoving: itemActions.isMoving,
        submitMove: itemActions.submitMove,
        onMoveDialogOpenChange: itemActions.onMoveDialogOpenChange,
        trashTarget: itemActions.trashTarget,
        isTrashing: itemActions.isTrashing,
        submitTrash: itemActions.submitTrash,
        onTrashDialogOpenChange: itemActions.onTrashDialogOpenChange,
        detailsTarget: itemActions.detailsTarget,
        isLoadingDetailsSummary: itemActions.isLoadingDetailsSummary,
        folderDetailsSummary: itemActions.folderDetailsSummary,
        onDetailsDialogOpenChange: itemActions.onDetailsDialogOpenChange,
        activeNameConflict,
        resolveActiveNameConflict
      }
    }),
    [
      activeNameConflict,
      breadcrumbs,
      currentFolderId,
      currentPath,
      files,
      folders,
      isLoadingEntries,
      itemActions,
      openFilePicker,
      openFileURL,
      orderBy,
      orderDirection,
      refreshCurrentPath,
      resolveActiveNameConflict,
      selectFiles,
      setCurrentFolderId,
      setListOrderBy,
      setListOrderDirection,
      setViewMode,
      viewMode
    ]
  )

  const recycleBinSection = useMemo<RecycleBinSectionState>(
    () => ({
      folders: recycleFolders,
      files: recycleFiles,
      isLoading: isLoadingRecycleBin,
      isRestoring: recycleBinActions.isRestoring,
      isDeletingForever: recycleBinActions.isDeletingForever,
      isClearing: recycleBinActions.isClearing,
      isClearDialogOpen: recycleBinActions.isClearDialogOpen,
      deleteForeverTarget: recycleBinActions.deleteForeverTarget,
      onRefresh: () => {
        void loadRecycleBinEntries()
      },
      onClear: recycleBinActions.onClearRecycleBin,
      onRestoreFile: recycleBinActions.onRestoreFile,
      onRestoreFolder: recycleBinActions.onRestoreFolder,
      onDeleteForeverFile: recycleBinActions.onDeleteForeverFile,
      onDeleteForeverFolder: recycleBinActions.onDeleteForeverFolder,
      onDeleteForeverDialogOpenChange: recycleBinActions.onDeleteForeverDialogOpenChange,
      onConfirmDeleteForever: recycleBinActions.submitDeleteForever,
      onClearDialogOpenChange: recycleBinActions.onClearDialogOpenChange,
      onConfirmClear: recycleBinActions.submitClearRecycleBin
    }),
    [isLoadingRecycleBin, loadRecycleBinEntries, recycleBinActions, recycleFiles, recycleFolders]
  )

  const transferPanel = useMemo<TransferPanelState>(
    () => ({
      isVisible: isPanelVisible,
      tasks,
      overview,
      onCancelAll: cancelAllTasks,
      onPauseAll: pauseAllTasks,
      onContinueAll: continueAllTasks,
      onCancelTask: cancelTask,
      onPauseTask: pauseTask,
      onContinueTask: continueTask,
      onClose: () => {
        if (overview.remainingTasks === 0) {
          cancelAllTasks()
          setPanelVisible(false)
        }
      }
    }),
    [
      cancelAllTasks,
      cancelTask,
      continueAllTasks,
      continueTask,
      isPanelVisible,
      overview,
      pauseAllTasks,
      pauseTask,
      setPanelVisible,
      tasks
    ]
  )

  const value = useMemo<FilesWorkspaceContextValue>(
    () => ({
      activeView,
      setActiveView,
      filesSection,
      recycleBinSection,
      transferPanel
    }),
    [activeView, filesSection, recycleBinSection, transferPanel]
  )

  return (
    <FilesWorkspaceContext.Provider value={value}>
      <input ref={filePickerInputRef} type="file" multiple className="hidden" onChange={onFilePickerChange} />
      {children}
    </FilesWorkspaceContext.Provider>
  )
}

export function FilesWorkspaceProvider({ children }: { children: ReactNode }) {
  return (
    <FileBrowserStoreProvider>
      <FilesWorkspaceProviderInner>{children}</FilesWorkspaceProviderInner>
    </FileBrowserStoreProvider>
  )
}

export function useFilesWorkspace() {
  const context = useContext(FilesWorkspaceContext)
  if (!context) {
    throw new Error('useFilesWorkspace must be used within FilesWorkspaceProvider')
  }

  return context
}
