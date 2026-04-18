import {
  ArrowDownToLine,
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  FileVideoIcon,
  FolderIcon,
  Trash2Icon
} from 'lucide-react'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { UploadFolderRecord, UploadedFileRecord } from '@/lib/upload/shared'

interface UploadEntryGridProps {
  folders: UploadFolderRecord[]
  files: UploadedFileRecord[]
  onNavigate?: (folderId: string) => void
  onOpenFile?: (fileId: string, mode: 'preview' | 'download') => void
  onRenameFile?: (file: UploadedFileRecord) => void
  onMoveFile?: (file: UploadedFileRecord) => void
  onTrashFile?: (file: UploadedFileRecord) => void
  onRestoreFile?: (file: UploadedFileRecord) => void
  onDeleteForeverFile?: (file: UploadedFileRecord) => void
  onRenameFolder?: (folder: UploadFolderRecord) => void
  onMoveFolder?: (folder: UploadFolderRecord) => void
  onTrashFolder?: (folder: UploadFolderRecord) => void
  onRestoreFolder?: (folder: UploadFolderRecord) => void
  onDeleteForeverFolder?: (folder: UploadFolderRecord) => void
  emptyMessage?: string
}

function formatDateTime(iso: string) {
  const date = new Date(iso)
  const pad = (value: number) => `${value}`.padStart(2, '0')
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`
}

function resolveFileIcon(file: UploadedFileRecord) {
  const extension = file.fileExtension.toLowerCase()
  const contentType = file.contentType.toLowerCase()

  if (contentType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
    return <FileImageIcon className="size-8 text-emerald-500" />
  }

  if (contentType.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) {
    return <FileVideoIcon className="size-8 text-sky-500" />
  }

  if (contentType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(extension)) {
    return <FileAudioIcon className="size-8 text-cyan-500" />
  }

  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return <FileArchiveIcon className="size-8 text-amber-500" />
  }

  if (['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'md', 'py', 'go', 'rs'].includes(extension)) {
    return <FileCodeIcon className="size-8 text-violet-500" />
  }

  if (contentType.startsWith('text/') || ['txt', 'pdf', 'doc', 'docx'].includes(extension)) {
    return <FileTextIcon className="size-8 text-blue-500" />
  }

  return <FileIcon className="size-8 text-muted-foreground" />
}

function NameWithTooltip({ value }: { value: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p className="truncate text-center text-sm font-medium">{value}</p>
      </TooltipTrigger>
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  )
}

function FolderEntryCard({
  folder,
  onNavigate,
  onRename,
  onMove,
  onTrash,
  onRestore,
  onDeleteForever
}: {
  folder: UploadFolderRecord
  onNavigate?: (folderId: string) => void
  onRename?: (folder: UploadFolderRecord) => void
  onMove?: (folder: UploadFolderRecord) => void
  onTrash?: (folder: UploadFolderRecord) => void
  onRestore?: (folder: UploadFolderRecord) => void
  onDeleteForever?: (folder: UploadFolderRecord) => void
}) {
  const canOpen = Boolean(onNavigate)
  const canRename = Boolean(onRename)
  const canMove = Boolean(onMove)
  const canTrash = Boolean(onTrash)
  const canRestore = Boolean(onRestore)
  const canDeleteForever = Boolean(onDeleteForever)
  const hasBaseActions = canOpen || canRename || canMove
  const hasTrashAction = canTrash
  const hasAnyAction = hasBaseActions || hasTrashAction || canRestore || canDeleteForever

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          className="group flex h-40 flex-col items-center justify-center gap-3 border p-4 text-left transition hover:bg-muted/40"
          onClick={() => onNavigate?.(folder.id)}
        >
          <FolderIcon className="size-9 text-amber-500" />
          <NameWithTooltip value={folder.folderName} />
          <p className="font-mono text-xs text-muted-foreground">{formatDateTime(folder.updatedAt)}</p>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {(canRename || canMove) && (
          <>
            {canRename && <ContextMenuItem onSelect={() => onRename?.(folder)}>重命名</ContextMenuItem>}
            {canMove && <ContextMenuItem onSelect={() => onMove?.(folder)}>移动</ContextMenuItem>}
          </>
        )}

        {canTrash && (
          <>
            {hasBaseActions && <ContextMenuSeparator />}
            <ContextMenuItem variant="destructive" onSelect={() => onTrash?.(folder)}>
              <Trash2Icon className="size-3.5" />
              放入回收站
            </ContextMenuItem>
          </>
        )}

        {canRestore && (
          <>
            {(hasBaseActions || hasTrashAction) && <ContextMenuSeparator />}
            <ContextMenuItem onSelect={() => onRestore?.(folder)}>还原</ContextMenuItem>
          </>
        )}

        {canDeleteForever && (
          <>
            {(hasBaseActions || hasTrashAction || canRestore) && <ContextMenuSeparator />}
            <ContextMenuItem variant="destructive" onSelect={() => onDeleteForever?.(folder)}>
              删除
            </ContextMenuItem>
          </>
        )}

        {!hasAnyAction ? <ContextMenuItem disabled>No actions available</ContextMenuItem> : null}
      </ContextMenuContent>
    </ContextMenu>
  )
}

function FileEntryCard({
  file,
  onOpenFile,
  onRename,
  onMove,
  onTrash,
  onRestore,
  onDeleteForever
}: {
  file: UploadedFileRecord
  onOpenFile?: (fileId: string, mode: 'preview' | 'download') => void
  onRename?: (file: UploadedFileRecord) => void
  onMove?: (file: UploadedFileRecord) => void
  onTrash?: (file: UploadedFileRecord) => void
  onRestore?: (file: UploadedFileRecord) => void
  onDeleteForever?: (file: UploadedFileRecord) => void
}) {
  const canOpen = Boolean(onOpenFile)
  const canRename = Boolean(onRename)
  const canMove = Boolean(onMove)
  const canTrash = Boolean(onTrash)
  const canRestore = Boolean(onRestore)
  const canDeleteForever = Boolean(onDeleteForever)
  const hasBaseActions = canOpen || canRename || canMove
  const hasTrashAction = canTrash
  const hasAnyAction = hasBaseActions || hasTrashAction || canRestore || canDeleteForever

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          className="group flex h-40 flex-col items-center justify-center gap-3 border p-4 text-left transition hover:bg-muted/40"
        >
          {resolveFileIcon(file)}
          <NameWithTooltip value={file.fileName} />
          <p className="font-mono text-xs text-muted-foreground">{formatDateTime(file.updatedAt)}</p>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {canOpen ? (
          <>
            <ContextMenuItem onSelect={() => onOpenFile?.(file.id, 'download')}>
              <ArrowDownToLine className="size-3.5" />
              下载
            </ContextMenuItem>
          </>
        ) : null}

        {(canRename || canMove) && (
          <>
            {canOpen ? <ContextMenuSeparator /> : null}
            {canRename ? <ContextMenuItem onSelect={() => onRename?.(file)}>重命名</ContextMenuItem> : null}
            {canMove ? <ContextMenuItem onSelect={() => onMove?.(file)}>移动</ContextMenuItem> : null}
          </>
        )}

        {canTrash && (
          <>
            {hasBaseActions && <ContextMenuSeparator />}
            <ContextMenuItem variant="destructive" onSelect={() => onTrash?.(file)}>
              <Trash2Icon className="size-3.5" />
              放入回收站
            </ContextMenuItem>
          </>
        )}

        {canRestore && (
          <>
            {(hasBaseActions || hasTrashAction) && <ContextMenuSeparator />}
            <ContextMenuItem onSelect={() => onRestore?.(file)}>还原</ContextMenuItem>
          </>
        )}

        {canDeleteForever && (
          <>
            {(hasBaseActions || hasTrashAction || canRestore) && <ContextMenuSeparator />}
            <ContextMenuItem variant="destructive" onSelect={() => onDeleteForever?.(file)}>
              删除
            </ContextMenuItem>
          </>
        )}

        {!hasAnyAction ? <ContextMenuItem disabled>No actions available</ContextMenuItem> : null}
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function UploadEntryGrid({
  folders,
  files,
  onNavigate,
  onOpenFile,
  onRenameFile,
  onMoveFile,
  onRenameFolder,
  onMoveFolder,
  onTrashFile,
  onTrashFolder,
  onRestoreFile,
  onDeleteForeverFile,
  onRestoreFolder,
  onDeleteForeverFolder,
  emptyMessage = 'This folder is empty'
}: UploadEntryGridProps) {
  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="min-h-65">
        <div className="border border-dashed p-10 text-center text-sm text-muted-foreground">{emptyMessage}</div>
      </div>
    )
  }

  return (
    <div className="min-h-65">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        {folders.map(folder => (
          <FolderEntryCard
            key={folder.id}
            folder={folder}
            onNavigate={onNavigate}
            onRename={onRenameFolder}
            onMove={onMoveFolder}
            onTrash={onTrashFolder}
            onRestore={onRestoreFolder}
            onDeleteForever={onDeleteForeverFolder}
          />
        ))}

        {files.map(file => (
          <FileEntryCard
            key={file.id}
            file={file}
            onOpenFile={onOpenFile}
            onRename={onRenameFile}
            onMove={onMoveFile}
            onTrash={onTrashFile}
            onRestore={onRestoreFile}
            onDeleteForever={onDeleteForeverFile}
          />
        ))}
      </div>
    </div>
  )
}
