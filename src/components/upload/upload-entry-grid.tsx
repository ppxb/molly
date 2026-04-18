import {
  ArrowDownToLine,
  Eye,
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  FileVideoIcon,
  FolderIcon
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
  onNavigate: (folderId: string) => void
  onOpenFile: (fileId: string, mode: 'preview' | 'download') => void
  onRenameFile: (file: UploadedFileRecord) => void
  onMoveFile: (file: UploadedFileRecord) => void
  onRenameFolder: (folder: UploadFolderRecord) => void
  onMoveFolder: (folder: UploadFolderRecord) => void
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
  onMove
}: {
  folder: UploadFolderRecord
  onNavigate: (folderId: string) => void
  onRename: (folder: UploadFolderRecord) => void
  onMove: (folder: UploadFolderRecord) => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          className="group flex h-40 flex-col items-center justify-center gap-3 border p-4 text-left transition hover:bg-muted/40"
          onDoubleClick={() => onNavigate(folder.id)}
        >
          <FolderIcon className="size-9 text-amber-500" />
          <NameWithTooltip value={folder.folderName} />
          <p className="font-mono text-xs text-muted-foreground">{formatDateTime(folder.updatedAt)}</p>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onNavigate(folder.id)}>Open</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onRename(folder)}>Rename</ContextMenuItem>
        <ContextMenuItem onSelect={() => onMove(folder)}>Move To</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function FileEntryCard({
  file,
  onOpenFile,
  onRename,
  onMove
}: {
  file: UploadedFileRecord
  onOpenFile: (fileId: string, mode: 'preview' | 'download') => void
  onRename: (file: UploadedFileRecord) => void
  onMove: (file: UploadedFileRecord) => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          className="group flex h-40 flex-col items-center justify-center gap-3 border p-4 text-left transition hover:bg-muted/40"
          onDoubleClick={() => onOpenFile(file.id, 'preview')}
        >
          {resolveFileIcon(file)}
          <NameWithTooltip value={file.fileName} />
          <p className="font-mono text-xs text-muted-foreground">{formatDateTime(file.updatedAt)}</p>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onOpenFile(file.id, 'preview')}>
          <Eye className="size-3.5" />
          Preview
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => onOpenFile(file.id, 'download')}>
          <ArrowDownToLine className="size-3.5" />
          Download
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onRename(file)}>Rename</ContextMenuItem>
        <ContextMenuItem onSelect={() => onMove(file)}>Move To</ContextMenuItem>
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
  onMoveFolder
}: UploadEntryGridProps) {
  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="min-h-65">
        <div className="border border-dashed p-10 text-center text-sm text-muted-foreground">This folder is empty</div>
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
          />
        ))}

        {files.map(file => (
          <FileEntryCard
            key={file.id}
            file={file}
            onOpenFile={onOpenFile}
            onRename={onRenameFile}
            onMove={onMoveFile}
          />
        ))}
      </div>
    </div>
  )
}
