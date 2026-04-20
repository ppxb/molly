import { useRef, useState, useCallback, type ChangeEvent } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useFileStore } from '@/stores/file-store'
import { fileKeys } from '@/api/query-keys'
import {
  listEntries,
  createFolder,
  renameItem,
  listMoveTargets,
  batchRequest,
  getFileAccessUrl,
  getFolderSizeInfo,
  getLatestAsyncTask
} from '@/api/file'
import { trashItem, restoreItem, deleteItemForever, clearRecycleBin, listRecycleBin } from '@/api/recycle-bin'
import { getErrorMessage } from '@/api/client'

import { useTransferQueue } from '@/features/upload/hooks/use-transfer-queue'
import { scheduleHashWorkerPrewarm } from '@/features/upload/hash'
import { FileBrowserView, FileBrowserDialogs, RecycleBinOverview } from '@/features/file-browser'
import type { FileBrowserDialogsProps } from '@/features/file-browser'
import { TransferPanelSection } from '@/features/upload/components/transfer-panel-section'

import type { DriveFileRecord, DriveFolderRecord } from '@/types/drive'
import type { ItemDetailsTarget, FolderDetailsSummary } from '@/features/file-browser/components/item-details-dialog'
import { DeleteForeverDialog } from '@/features/file-browser/components/delete-forever-dialog'
import { ClearRecycleBinDialog } from '@/features/file-browser/components/clear-recycle-bin-dialog'

// ─── 侧边导航 ─────────────────────────────────────────────────────────────────

import { FolderIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WorkspaceView } from '@/stores/file-store'

const NAV_ITEMS: Array<{ id: WorkspaceView; label: string; description: string; icon: typeof FolderIcon }> = [
  { id: 'files', label: '全部文件', description: '浏览、上传和整理当前网盘内容', icon: FolderIcon },
  { id: 'recyclebin', label: '回收站', description: '恢复或彻底删除已移入回收站的内容', icon: Trash2Icon }
]

function WorkspaceNav({ activeView, onChange }: { activeView: WorkspaceView; onChange: (v: WorkspaceView) => void }) {
  return (
    <div className="h-full px-4 py-6">
      <div className="space-y-1 px-2 pb-4">
        <div className="text-sm font-semibold">文件工作区</div>
        <div className="text-xs text-muted-foreground">切换全部文件与回收站视图。</div>
      </div>
      <div className="space-y-2">
        {NAV_ITEMS.map(({ id, label, description, icon: Icon }) => {
          const isActive = activeView === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition ${isActive ? 'border-foreground/20 bg-muted' : 'border-border/70 hover:bg-muted/50'}`}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`} />
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
              </div>
            </button>
          )
        })}
      </div>
      {/* 移动端横向 */}
      <div className="flex gap-2 pt-4 md:hidden">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            type="button"
            variant={activeView === id ? 'default' : 'outline'}
            onClick={() => onChange(id)}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  )
}

// ─── Dialog 状态类型 ──────────────────────────────────────────────────────────

interface RenameTarget {
  id: string
  type: 'file' | 'folder'
  name: string
}
interface MoveTarget {
  id: string
  type: 'file' | 'folder'
  name: string
  currentFolderId: string
  excludeFolderId?: string
}
interface TrashTarget {
  id: string
  type: 'file' | 'folder'
  name: string
}
interface DeleteTarget {
  id: string
  type: 'file' | 'folder'
  name: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_app/file')({
  component: FilePage,
  onEnter: () => scheduleHashWorkerPrewarm()
})

function FilePage() {
  const queryClient = useQueryClient()

  // ── UI 状态（Zustand）──────────────────────────────────────────────────────
  const {
    currentFolderId,
    setCurrentFolderId,
    activeView,
    setActiveView,
    orderBy,
    orderDirection,
    viewMode,
    setOrderBy,
    setOrderDirection,
    setViewMode
  } = useFileStore()

  // ── 文件列表查询 ───────────────────────────────────────────────────────────
  const entriesKey = fileKeys.entries(currentFolderId, orderBy, orderDirection)
  const entriesQuery = useQuery({
    queryKey: entriesKey,
    queryFn: () => listEntries(currentFolderId, { orderBy, orderDirection }),
    enabled: activeView === 'files'
  })

  // ── 回收站查询 ────────────────────────────────────────────────────────────
  const recycleBinQuery = useQuery({
    queryKey: fileKeys.recycleBin(),
    queryFn: listRecycleBin,
    enabled: activeView === 'recyclebin'
  })

  // ── Dialog 状态 ───────────────────────────────────────────────────────────
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  const [trashTarget, setTrashTarget] = useState<TrashTarget | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<ItemDetailsTarget | null>(null)
  const [deleteForeverTarget, setDeleteForeverTarget] = useState<DeleteTarget | null>(null)
  const [clearBinOpen, setClearBinOpen] = useState(false)

  // ── 移动目标文件夹查询（仅弹窗开启时）────────────────────────────────────
  const moveTargetsQuery = useQuery({
    queryKey: fileKeys.moveTargets(moveTarget?.excludeFolderId),
    queryFn: () => listMoveTargets(moveTarget?.excludeFolderId),
    enabled: moveTarget !== null
  })

  // ── 文件夹大小查询（详情弹窗，仅 folder 类型）────────────────────────────
  const folderSizeQuery = useQuery({
    queryKey: fileKeys.folderSize(detailsTarget?.id ?? ''),
    queryFn: () => getFolderSizeInfo(detailsTarget!.id),
    enabled: detailsTarget?.type === 'folder'
  })

  const folderDetailsSummary: FolderDetailsSummary | null = folderSizeQuery.data
    ? {
        size: folderSizeQuery.data.size,
        fileCount: folderSizeQuery.data.file_count,
        folderCount: folderSizeQuery.data.folder_count,
        displaySummary: folderSizeQuery.data.display_summary
      }
    : null

  // ── Mutations ─────────────────────────────────────────────────────────────

  const invalidateEntries = useCallback(
    () => queryClient.invalidateQueries({ queryKey: entriesKey }),
    [queryClient, entriesKey]
  )

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => createFolder(currentFolderId, name),
    onSuccess: () => {
      setCreateFolderOpen(false)
      void invalidateEntries()
    }
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameItem(id, name),
    onSuccess: () => {
      setRenameTarget(null)
      void invalidateEntries()
    }
  })

  const moveMutation = useMutation({
    mutationFn: async ({ targetFolderId }: { targetFolderId: string }) => {
      if (!moveTarget) return
      await getLatestAsyncTask()
      const batch = await batchRequest({
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
      if (!result || result.status !== 200) throw new Error('移动失败')
    },
    onSuccess: () => {
      setMoveTarget(null)
      void invalidateEntries()
    }
  })

  // trash：乐观更新，立即从列表移除
  const trashMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => trashItem(id),
    onMutate: async ({ id, type }: { id: string; type: 'file' | 'folder' }) => {
      await queryClient.cancelQueries({ queryKey: entriesKey })
      const snapshot = queryClient.getQueryData(entriesKey)
      queryClient.setQueryData(entriesKey, (old: typeof entriesQuery.data) => {
        if (!old) return old
        return type === 'file'
          ? { ...old, files: old.files.filter(f => f.id !== id) }
          : { ...old, folders: old.folders.filter(f => f.id !== id) }
      })
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(entriesKey, ctx.snapshot)
    },
    onSettled: () => {
      setTrashTarget(null)
      void invalidateEntries()
    }
  })

  // restore：乐观更新，从回收站移除
  const restoreMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => restoreItem(id),
    onMutate: async ({ id, type }: { id: string; type: 'file' | 'folder' }) => {
      await queryClient.cancelQueries({ queryKey: fileKeys.recycleBin() })
      const snapshot = queryClient.getQueryData(fileKeys.recycleBin())
      queryClient.setQueryData(fileKeys.recycleBin(), (old: typeof recycleBinQuery.data) => {
        if (!old) return old
        return type === 'file'
          ? { ...old, files: old.files.filter(f => f.id !== id) }
          : { ...old, folders: old.folders.filter(f => f.id !== id) }
      })
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(fileKeys.recycleBin(), ctx.snapshot)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: fileKeys.recycleBin() })
  })

  // deleteForever：乐观更新，从回收站移除
  const deleteForeverMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteItemForever(id),
    onMutate: async ({ id, type }: { id: string; type: 'file' | 'folder' }) => {
      await queryClient.cancelQueries({ queryKey: fileKeys.recycleBin() })
      const snapshot = queryClient.getQueryData(fileKeys.recycleBin())
      queryClient.setQueryData(fileKeys.recycleBin(), (old: typeof recycleBinQuery.data) => {
        if (!old) return old
        return type === 'file'
          ? { ...old, files: old.files.filter(f => f.id !== id) }
          : { ...old, folders: old.folders.filter(f => f.id !== id) }
      })
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(fileKeys.recycleBin(), ctx.snapshot)
    },
    onSettled: () => {
      setDeleteForeverTarget(null)
      queryClient.invalidateQueries({ queryKey: fileKeys.recycleBin() })
    }
  })

  // clearBin：乐观清空
  const clearBinMutation = useMutation({
    mutationFn: clearRecycleBin,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: fileKeys.recycleBin() })
      const snapshot = queryClient.getQueryData(fileKeys.recycleBin())
      queryClient.setQueryData(fileKeys.recycleBin(), (old: typeof recycleBinQuery.data) =>
        old ? { ...old, files: [], folders: [] } : old
      )
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) queryClient.setQueryData(fileKeys.recycleBin(), ctx.snapshot)
    },
    onSettled: () => {
      setClearBinOpen(false)
      queryClient.invalidateQueries({ queryKey: fileKeys.recycleBin() })
    }
  })

  // ── 文件访问 ──────────────────────────────────────────────────────────────
  const openFile = useCallback(async (fileId: string, mode: 'preview' | 'download') => {
    try {
      const data = await getFileAccessUrl(fileId, mode)
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(getErrorMessage(err, '打开文件失败'))
    }
  }, [])

  // ── 上传队列 ──────────────────────────────────────────────────────────────
  const [transferVisible, setTransferVisible] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const transferQueue = useTransferQueue({
    onTaskFinalizeStart: file => {
      // 乐观插入：上传完成前先显示文件
      queryClient.setQueryData(entriesKey, (old: typeof entriesQuery.data) => {
        if (!old || file.folderId !== currentFolderId) return old
        const exists = old.files.some(f => f.id === file.id)
        return exists
          ? { ...old, files: old.files.map(f => (f.id === file.id ? file : f)) }
          : { ...old, files: [file, ...old.files] }
      })
    },
    onTaskFinalizeAbort: file => {
      // 回滚：移除乐观插入的文件
      queryClient.setQueryData(entriesKey, (old: typeof entriesQuery.data) => {
        if (!old) return old
        return { ...old, files: old.files.filter(f => f.id !== file.id) }
      })
    },
    onTaskDone: async file => {
      if (file.folderId === currentFolderId) void invalidateEntries()
    }
  })

  const handleFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return
      transferQueue.addFiles(files, {
        folderId: currentFolderId,
        folderPath: entriesQuery.data?.path
      })
      setTransferVisible(true)
    },
    [currentFolderId, entriesQuery.data?.path, transferQueue]
  )

  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleFiles(Array.from(e.target.files ?? []))
      e.target.value = ''
    },
    [handleFiles]
  )

  // ── FileBrowserDialogs props ──────────────────────────────────────────────
  const dialogsProps: FileBrowserDialogsProps = {
    currentPath: entriesQuery.data?.path ?? '',

    isCreateFolderDialogOpen: createFolderOpen,
    setIsCreateFolderDialogOpen: setCreateFolderOpen,
    isCreatingFolder: createFolderMutation.isPending,
    createFolder: createFolderMutation.mutateAsync,

    renameTarget,
    isRenaming: renameMutation.isPending,
    submitRename: name => renameMutation.mutateAsync({ id: renameTarget!.id, name }),
    onRenameDialogOpenChange: open => {
      if (!open) setRenameTarget(null)
    },

    moveTarget: moveTarget
      ? {
          id: moveTarget.id,
          type: moveTarget.type,
          name: moveTarget.name,
          initialTargetFolderId: moveTarget.currentFolderId
        }
      : null,
    moveTargetFolders: moveTargetsQuery.data?.folders ?? [],
    isLoadingMoveTargets: moveTargetsQuery.isLoading,
    isMoving: moveMutation.isPending,
    submitMove: targetFolderId => moveMutation.mutateAsync({ targetFolderId }),
    onMoveDialogOpenChange: open => {
      if (!open) setMoveTarget(null)
    },

    trashTarget,
    isTrashing: trashMutation.isPending,
    submitTrash: () => trashMutation.mutateAsync({ id: trashTarget!.id, type: trashTarget!.type }),
    onTrashDialogOpenChange: open => {
      if (!open) setTrashTarget(null)
    },

    detailsTarget,
    isLoadingDetailsSummary: folderSizeQuery.isLoading,
    folderDetailsSummary,
    onDetailsDialogOpenChange: open => {
      if (!open) setDetailsTarget(null)
    },

    // 上传冲突对话框
    activeNameConflict: transferQueue.activeConflict,
    resolveActiveNameConflict: transferQueue.resolveConflict
  }

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  const entries = entriesQuery.data
  const recycleBin = recycleBinQuery.data

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* 侧边导航 */}
      <aside className="hidden w-72 shrink-0 border-r border-border/70 bg-muted/20 md:block">
        <WorkspaceNav activeView={activeView} onChange={setActiveView} />
      </aside>

      <div className="relative min-w-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="flex w-full min-w-0 flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
            {activeView === 'files' && (
              <>
                <FileBrowserView
                  currentFolderId={currentFolderId}
                  breadcrumbs={entries?.breadcrumbs ?? []}
                  folders={entries?.folders ?? []}
                  files={entries?.files ?? []}
                  isLoading={entriesQuery.isLoading}
                  orderBy={orderBy}
                  orderDirection={orderDirection}
                  viewMode={viewMode}
                  onRefresh={() => queryClient.invalidateQueries({ queryKey: entriesKey })}
                  onChangeOrderBy={setOrderBy}
                  onChangeOrderDirection={setOrderDirection}
                  onChangeViewMode={setViewMode}
                  onNavigate={setCurrentFolderId}
                  onOpenFile={openFile}
                  onAddFiles={() => fileInputRef.current?.click()}
                  onCreateFolder={() => setCreateFolderOpen(true)}
                  onRenameFile={f => setRenameTarget({ id: f.id, type: 'file', name: f.fileName })}
                  onMoveFile={f =>
                    setMoveTarget({ id: f.id, type: 'file', name: f.fileName, currentFolderId: f.folderId })
                  }
                  onViewDetailsFile={f =>
                    setDetailsTarget({
                      id: f.id,
                      type: 'file',
                      name: f.fileName,
                      location: f.folderPath || 'root',
                      createdAt: f.createdAt,
                      updatedAt: f.updatedAt,
                      hash: f.fileHash
                    })
                  }
                  onTrashFile={f => setTrashTarget({ id: f.id, type: 'file', name: f.fileName })}
                  onRenameFolder={f => setRenameTarget({ id: f.id, type: 'folder', name: f.folderName })}
                  onMoveFolder={f =>
                    setMoveTarget({
                      id: f.id,
                      type: 'folder',
                      name: f.folderName,
                      currentFolderId: f.parentId ?? 'root',
                      excludeFolderId: f.id
                    })
                  }
                  onViewDetailsFolder={f =>
                    setDetailsTarget({
                      id: f.id,
                      type: 'folder',
                      name: f.folderName,
                      location: f.parentPath || 'root',
                      createdAt: f.createdAt,
                      updatedAt: f.updatedAt
                    })
                  }
                  onTrashFolder={f => setTrashTarget({ id: f.id, type: 'folder', name: f.folderName })}
                />
                <FileBrowserDialogs {...dialogsProps} />
              </>
            )}

            {activeView === 'recyclebin' && (
              <>
                <RecycleBinOverview
                  folders={recycleBin?.folders ?? []}
                  files={recycleBin?.files ?? []}
                  isLoading={recycleBinQuery.isLoading}
                  isRestoring={restoreMutation.isPending}
                  isClearing={clearBinMutation.isPending}
                  onRefresh={() => queryClient.invalidateQueries({ queryKey: fileKeys.recycleBin() })}
                  onClear={() => setClearBinOpen(true)}
                  onRestoreFile={(f: DriveFileRecord) => restoreMutation.mutate({ id: f.id, type: 'file' })}
                  onRestoreFolder={(f: DriveFolderRecord) => restoreMutation.mutate({ id: f.id, type: 'folder' })}
                  onDeleteForeverFile={(f: DriveFileRecord) =>
                    setDeleteForeverTarget({ id: f.id, type: 'file', name: f.fileName })
                  }
                  onDeleteForeverFolder={(f: DriveFolderRecord) =>
                    setDeleteForeverTarget({ id: f.id, type: 'folder', name: f.folderName })
                  }
                />
                <DeleteForeverDialog
                  open={deleteForeverTarget !== null}
                  type={deleteForeverTarget?.type ?? 'file'}
                  name={deleteForeverTarget?.name ?? ''}
                  isSubmitting={deleteForeverMutation.isPending}
                  onOpenChange={open => {
                    if (!open) setDeleteForeverTarget(null)
                  }}
                  onConfirm={() =>
                    deleteForeverMutation.mutateAsync({ id: deleteForeverTarget!.id, type: deleteForeverTarget!.type })
                  }
                />
                <ClearRecycleBinDialog
                  open={clearBinOpen}
                  isSubmitting={clearBinMutation.isPending}
                  onOpenChange={setClearBinOpen}
                  onConfirm={clearBinMutation.mutateAsync}
                />
              </>
            )}
          </div>
        </div>

        {/* 上传面板 */}
        <TransferPanelSection
          isVisible={transferVisible}
          tasks={transferQueue.tasks}
          overview={transferQueue.overview}
          onCancelAll={transferQueue.cancelAll}
          onPauseAll={transferQueue.pauseAll}
          onContinueAll={transferQueue.continueAll}
          onCancelTask={transferQueue.cancelTask}
          onPauseTask={transferQueue.pauseTask}
          onContinueTask={transferQueue.continueTask}
          onClose={() => {
            if (transferQueue.overview.remainingTasks === 0) {
              transferQueue.cancelAll()
              setTransferVisible(false)
            }
          }}
        />
      </div>

      {/* 隐藏文件选择器 */}
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />
    </div>
  )
}
