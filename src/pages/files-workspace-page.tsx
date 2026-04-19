import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react'
import { FolderIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FileBrowserStoreProvider,
  FilesSection,
  RecycleBinSection,
  useFileBrowser,
  useItemActions
} from '@/features/file-browser'
import { useRecycleBinActions } from '@/features/file-browser/hooks/use-recycle-bin-actions'
import { useRecycleBinEntries } from '@/features/file-browser/hooks/use-recycle-bin-entries'
import { UploadPanelSection } from '@/features/upload/components/upload-panel-section'
import { useUploadQueue } from '@/features/upload/hooks/use-upload-queue'
import { getErrorMessage, getFileAccessUrlRequest } from '@/lib/drive/client/api'
import { scheduleHashWorkerPrewarm } from '@/lib/drive/client/hash'

type FilesWorkspaceView = 'files' | 'recyclebin'

interface WorkspaceNavItem {
  id: FilesWorkspaceView
  label: string
  description: string
  icon: typeof FolderIcon
}

const workspaceNavItems: WorkspaceNavItem[] = [
  {
    id: 'files',
    label: '全部文件',
    description: '浏览、上传和整理当前网盘内容',
    icon: FolderIcon
  },
  {
    id: 'recyclebin',
    label: '回收站',
    description: '恢复或彻底删除已移入回收站的内容',
    icon: Trash2Icon
  }
]

function FilesWorkspaceNav({
  activeView,
  onChange,
  mode
}: {
  activeView: FilesWorkspaceView
  onChange: (view: FilesWorkspaceView) => void
  mode: 'desktop' | 'mobile'
}) {
  if (mode === 'mobile') {
    return (
      <div className="flex gap-2 md:hidden">
        {workspaceNavItems.map(item => {
          const Icon = item.icon
          return (
            <Button
              key={item.id}
              type="button"
              variant={activeView === item.id ? 'default' : 'outline'}
              onClick={() => onChange(item.id)}
            >
              <Icon className="size-4" />
              {item.label}
            </Button>
          )
        })}
      </div>
    )
  }

  return (
    <Card className="h-fit border-border/70">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">文件工作区</CardTitle>
        <CardDescription>在这里切换全部文件与回收站视图。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {workspaceNavItems.map(item => {
          const Icon = item.icon
          const isActive = activeView === item.id

          return (
            <button
              key={item.id}
              type="button"
              className={`flex w-full items-start gap-3 border p-3 text-left transition ${
                isActive ? 'border-foreground/20 bg-muted' : 'border-border/70 hover:bg-muted/50'
              }`}
              onClick={() => onChange(item.id)}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.description}</div>
              </div>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}

function FilesWorkspacePageContent() {
  const [activeView, setActiveView] = useState<FilesWorkspaceView>('files')
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
    removeItemOptimistic,
    clearAllOptimistic
  } = useRecycleBinEntries()

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
  } = useRecycleBinActions({
    refresh: loadRecycleBinEntries,
    removeItemOptimistic,
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
  } = useItemActions({
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
    <div className="flex h-full min-h-0 flex-1 overflow-hidden">
      <input ref={quickUploadInputRef} type="file" multiple className="hidden" onChange={onQuickUploadChange} />

      <div className="hidden w-72 shrink-0 border-r border-border/70 bg-background/70 px-4 py-6 md:block">
        <FilesWorkspaceNav activeView={activeView} onChange={setActiveView} mode="desktop" />
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <FilesWorkspaceNav activeView={activeView} onChange={setActiveView} mode="mobile" />

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
        </div>
      </div>

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

export function FilesWorkspacePage() {
  return (
    <FileBrowserStoreProvider>
      <FilesWorkspacePageContent />
    </FileBrowserStoreProvider>
  )
}
