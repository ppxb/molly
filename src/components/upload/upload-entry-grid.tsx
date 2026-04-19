import type { ReactNode } from 'react'
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
import { formatBytes, formatDateTime } from '@/lib/utils'

interface UploadEntryGridProps {
  folders: UploadFolderRecord[]
  files: UploadedFileRecord[]
  viewMode?: 'grid' | 'table'
  onNavigate?: (folderId: string) => void
  onOpenFile?: (fileId: string, mode: 'preview' | 'download') => void
  onRenameFile?: (file: UploadedFileRecord) => void
  onMoveFile?: (file: UploadedFileRecord) => void
  onViewDetailsFile?: (file: UploadedFileRecord) => void
  onTrashFile?: (file: UploadedFileRecord) => void
  onRestoreFile?: (file: UploadedFileRecord) => void
  onDeleteForeverFile?: (file: UploadedFileRecord) => void
  onRenameFolder?: (folder: UploadFolderRecord) => void
  onMoveFolder?: (folder: UploadFolderRecord) => void
  onViewDetailsFolder?: (folder: UploadFolderRecord) => void
  onTrashFolder?: (folder: UploadFolderRecord) => void
  onRestoreFolder?: (folder: UploadFolderRecord) => void
  onDeleteForeverFolder?: (folder: UploadFolderRecord) => void
  emptyMessage?: string
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

function EntryNameCell({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="shrink-0">{icon}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  )
}

function FolderMenuContent({
  folder,
  onRename,
  onMove,
  onViewDetails,
  onTrash,
  onRestore,
  onDeleteForever
}: {
  folder: UploadFolderRecord
  onRename?: (folder: UploadFolderRecord) => void
  onMove?: (folder: UploadFolderRecord) => void
  onViewDetails?: (folder: UploadFolderRecord) => void
  onTrash?: (folder: UploadFolderRecord) => void
  onRestore?: (folder: UploadFolderRecord) => void
  onDeleteForever?: (folder: UploadFolderRecord) => void
}) {
  const canRename = Boolean(onRename)
  const canMove = Boolean(onMove)
  const canViewDetails = Boolean(onViewDetails)
  const canTrash = Boolean(onTrash)
  const canRestore = Boolean(onRestore)
  const canDeleteForever = Boolean(onDeleteForever)
  const hasBaseActions = canRename || canMove || canViewDetails

  return (
    <ContextMenuContent>
      {canRename ? <ContextMenuItem onSelect={() => onRename?.(folder)}>Rename</ContextMenuItem> : null}
      {canMove ? <ContextMenuItem onSelect={() => onMove?.(folder)}>Move</ContextMenuItem> : null}
      {canViewDetails ? <ContextMenuItem onSelect={() => onViewDetails?.(folder)}>View Details</ContextMenuItem> : null}

      {canTrash ? (
        <>
          {hasBaseActions ? <ContextMenuSeparator /> : null}
          <ContextMenuItem variant="destructive" onSelect={() => onTrash?.(folder)}>
            <Trash2Icon className="size-3.5" />
            Move To Recycle Bin
          </ContextMenuItem>
        </>
      ) : null}

      {canRestore ? (
        <>
          {hasBaseActions || canTrash ? <ContextMenuSeparator /> : null}
          <ContextMenuItem onSelect={() => onRestore?.(folder)}>Restore</ContextMenuItem>
        </>
      ) : null}

      {canDeleteForever ? (
        <>
          {hasBaseActions || canTrash || canRestore ? <ContextMenuSeparator /> : null}
          <ContextMenuItem variant="destructive" onSelect={() => onDeleteForever?.(folder)}>
            Delete Forever
          </ContextMenuItem>
        </>
      ) : null}
    </ContextMenuContent>
  )
}

function FileMenuContent({
  file,
  onOpenFile,
  onRename,
  onMove,
  onViewDetails,
  onTrash,
  onRestore,
  onDeleteForever
}: {
  file: UploadedFileRecord
  onOpenFile?: (fileId: string, mode: 'preview' | 'download') => void
  onRename?: (file: UploadedFileRecord) => void
  onMove?: (file: UploadedFileRecord) => void
  onViewDetails?: (file: UploadedFileRecord) => void
  onTrash?: (file: UploadedFileRecord) => void
  onRestore?: (file: UploadedFileRecord) => void
  onDeleteForever?: (file: UploadedFileRecord) => void
}) {
  const canOpen = Boolean(onOpenFile)
  const canRename = Boolean(onRename)
  const canMove = Boolean(onMove)
  const canViewDetails = Boolean(onViewDetails)
  const canTrash = Boolean(onTrash)
  const canRestore = Boolean(onRestore)
  const canDeleteForever = Boolean(onDeleteForever)
  const hasBaseActions = canOpen || canRename || canMove || canViewDetails

  return (
    <ContextMenuContent>
      {canOpen ? (
        <ContextMenuItem onSelect={() => onOpenFile?.(file.id, 'download')}>
          <ArrowDownToLine className="size-3.5" />
          Download
        </ContextMenuItem>
      ) : null}

      {canRename ? <ContextMenuItem onSelect={() => onRename?.(file)}>Rename</ContextMenuItem> : null}
      {canMove ? <ContextMenuItem onSelect={() => onMove?.(file)}>Move</ContextMenuItem> : null}
      {canViewDetails ? <ContextMenuItem onSelect={() => onViewDetails?.(file)}>View Details</ContextMenuItem> : null}

      {canTrash ? (
        <>
          {hasBaseActions ? <ContextMenuSeparator /> : null}
          <ContextMenuItem variant="destructive" onSelect={() => onTrash?.(file)}>
            <Trash2Icon className="size-3.5" />
            Move To Recycle Bin
          </ContextMenuItem>
        </>
      ) : null}

      {canRestore ? (
        <>
          {hasBaseActions || canTrash ? <ContextMenuSeparator /> : null}
          <ContextMenuItem onSelect={() => onRestore?.(file)}>Restore</ContextMenuItem>
        </>
      ) : null}

      {canDeleteForever ? (
        <>
          {hasBaseActions || canTrash || canRestore ? <ContextMenuSeparator /> : null}
          <ContextMenuItem variant="destructive" onSelect={() => onDeleteForever?.(file)}>
            Delete Forever
          </ContextMenuItem>
        </>
      ) : null}
    </ContextMenuContent>
  )
}

function FolderEntryCard({
  folder,
  onNavigate,
  onRename,
  onMove,
  onViewDetails,
  onTrash,
  onRestore,
  onDeleteForever
}: {
  folder: UploadFolderRecord
  onNavigate?: (folderId: string) => void
  onRename?: (folder: UploadFolderRecord) => void
  onMove?: (folder: UploadFolderRecord) => void
  onViewDetails?: (folder: UploadFolderRecord) => void
  onTrash?: (folder: UploadFolderRecord) => void
  onRestore?: (folder: UploadFolderRecord) => void
  onDeleteForever?: (folder: UploadFolderRecord) => void
}) {
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
      <FolderMenuContent
        folder={folder}
        onRename={onRename}
        onMove={onMove}
        onViewDetails={onViewDetails}
        onTrash={onTrash}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />
    </ContextMenu>
  )
}

function FileEntryCard({
  file,
  onOpenFile,
  onRename,
  onMove,
  onViewDetails,
  onTrash,
  onRestore,
  onDeleteForever
}: {
  file: UploadedFileRecord
  onOpenFile?: (fileId: string, mode: 'preview' | 'download') => void
  onRename?: (file: UploadedFileRecord) => void
  onMove?: (file: UploadedFileRecord) => void
  onViewDetails?: (file: UploadedFileRecord) => void
  onTrash?: (file: UploadedFileRecord) => void
  onRestore?: (file: UploadedFileRecord) => void
  onDeleteForever?: (file: UploadedFileRecord) => void
}) {
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
      <FileMenuContent
        file={file}
        onOpenFile={onOpenFile}
        onRename={onRename}
        onMove={onMove}
        onViewDetails={onViewDetails}
        onTrash={onTrash}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />
    </ContextMenu>
  )
}

function FolderEntryRow({
  folder,
  onNavigate,
  onRename,
  onMove,
  onViewDetails,
  onTrash,
  onRestore,
  onDeleteForever
}: {
  folder: UploadFolderRecord
  onNavigate?: (folderId: string) => void
  onRename?: (folder: UploadFolderRecord) => void
  onMove?: (folder: UploadFolderRecord) => void
  onViewDetails?: (folder: UploadFolderRecord) => void
  onTrash?: (folder: UploadFolderRecord) => void
  onRestore?: (folder: UploadFolderRecord) => void
  onDeleteForever?: (folder: UploadFolderRecord) => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <tr className="border-b transition hover:bg-muted/40" onClick={() => onNavigate?.(folder.id)}>
          <td className="max-w-0 px-3 py-2">
            <EntryNameCell icon={<FolderIcon className="size-5 text-amber-500" />} value={folder.folderName} />
          </td>
          <td className="px-3 py-2 text-sm whitespace-nowrap text-muted-foreground">
            {formatDateTime(folder.createdAt)}
          </td>
          <td className="px-3 py-2 text-sm whitespace-nowrap text-muted-foreground">-</td>
        </tr>
      </ContextMenuTrigger>
      <FolderMenuContent
        folder={folder}
        onRename={onRename}
        onMove={onMove}
        onViewDetails={onViewDetails}
        onTrash={onTrash}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />
    </ContextMenu>
  )
}

function FileEntryRow({
  file,
  onOpenFile,
  onRename,
  onMove,
  onViewDetails,
  onTrash,
  onRestore,
  onDeleteForever
}: {
  file: UploadedFileRecord
  onOpenFile?: (fileId: string, mode: 'preview' | 'download') => void
  onRename?: (file: UploadedFileRecord) => void
  onMove?: (file: UploadedFileRecord) => void
  onViewDetails?: (file: UploadedFileRecord) => void
  onTrash?: (file: UploadedFileRecord) => void
  onRestore?: (file: UploadedFileRecord) => void
  onDeleteForever?: (file: UploadedFileRecord) => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <tr className="border-b transition hover:bg-muted/40">
          <td className="max-w-0 px-3 py-2">
            <EntryNameCell icon={resolveFileIcon(file)} value={file.fileName} />
          </td>
          <td className="px-3 py-2 text-sm whitespace-nowrap text-muted-foreground">
            {formatDateTime(file.createdAt)}
          </td>
          <td className="px-3 py-2 text-sm whitespace-nowrap text-muted-foreground">{formatBytes(file.fileSize)}</td>
        </tr>
      </ContextMenuTrigger>
      <FileMenuContent
        file={file}
        onOpenFile={onOpenFile}
        onRename={onRename}
        onMove={onMove}
        onViewDetails={onViewDetails}
        onTrash={onTrash}
        onRestore={onRestore}
        onDeleteForever={onDeleteForever}
      />
    </ContextMenu>
  )
}

export function UploadEntryGrid({
  folders,
  files,
  viewMode = 'grid',
  onNavigate,
  onOpenFile,
  onRenameFile,
  onMoveFile,
  onViewDetailsFile,
  onRenameFolder,
  onMoveFolder,
  onViewDetailsFolder,
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

  if (viewMode === 'table') {
    return (
      <div className="min-h-65">
        <div className="overflow-x-auto border">
          <table className="w-full min-w-[720px] table-fixed border-collapse">
            <thead className="bg-muted/30">
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="w-48 px-3 py-2 font-medium">Created Time</th>
                <th className="w-36 px-3 py-2 font-medium">Size</th>
              </tr>
            </thead>
            <tbody>
              {folders.map(folder => (
                <FolderEntryRow
                  key={folder.id}
                  folder={folder}
                  onNavigate={onNavigate}
                  onRename={onRenameFolder}
                  onMove={onMoveFolder}
                  onViewDetails={onViewDetailsFolder}
                  onTrash={onTrashFolder}
                  onRestore={onRestoreFolder}
                  onDeleteForever={onDeleteForeverFolder}
                />
              ))}

              {files.map(file => (
                <FileEntryRow
                  key={file.id}
                  file={file}
                  onOpenFile={onOpenFile}
                  onRename={onRenameFile}
                  onMove={onMoveFile}
                  onViewDetails={onViewDetailsFile}
                  onTrash={onTrashFile}
                  onRestore={onRestoreFile}
                  onDeleteForever={onDeleteForeverFile}
                />
              ))}
            </tbody>
          </table>
        </div>
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
            onViewDetails={onViewDetailsFolder}
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
            onViewDetails={onViewDetailsFile}
            onTrash={onTrashFile}
            onRestore={onRestoreFile}
            onDeleteForever={onDeleteForeverFile}
          />
        ))}
      </div>
    </div>
  )
}
