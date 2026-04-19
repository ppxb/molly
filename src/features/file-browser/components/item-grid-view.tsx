import type { ReactNode } from 'react'
import {
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  FileVideoIcon,
  FolderIcon
} from 'lucide-react'

import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  FileContextMenuContent,
  FolderContextMenuContent
} from '@/features/file-browser/components/item-context-menu-content'
import type { UploadFolderRecord, UploadedFileRecord } from '@/lib/drive/shared'
import { formatDateTime } from '@/lib/utils'

export interface ItemActionProps {
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
}

interface ItemGridViewProps extends ItemActionProps {
  folders: UploadFolderRecord[]
  files: UploadedFileRecord[]
}

export function resolveFileIcon(file: UploadedFileRecord) {
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

function ItemCard({
  icon,
  name,
  updatedAt,
  onClick,
  menu
}: {
  icon: ReactNode
  name: string
  updatedAt: string
  onClick?: () => void
  menu: ReactNode
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          className="group flex h-40 flex-col items-center justify-center gap-3 border p-4 text-left transition hover:bg-muted/40"
          onClick={onClick}
        >
          {icon}
          <NameWithTooltip value={name} />
          <p className="font-mono text-xs text-muted-foreground">{formatDateTime(updatedAt)}</p>
        </button>
      </ContextMenuTrigger>
      {menu}
    </ContextMenu>
  )
}

export function ItemGridView({
  folders,
  files,
  onNavigate,
  onOpenFile,
  onRenameFile,
  onMoveFile,
  onViewDetailsFile,
  onTrashFile,
  onRestoreFile,
  onDeleteForeverFile,
  onRenameFolder,
  onMoveFolder,
  onViewDetailsFolder,
  onTrashFolder,
  onRestoreFolder,
  onDeleteForeverFolder
}: ItemGridViewProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
      {folders.map(folder => (
        <ItemCard
          key={folder.id}
          icon={<FolderIcon className="size-9 text-amber-500" />}
          name={folder.folderName}
          updatedAt={folder.updatedAt}
          onClick={onNavigate ? () => onNavigate(folder.id) : undefined}
          menu={
            <FolderContextMenuContent
              folder={folder}
              onRename={onRenameFolder}
              onMove={onMoveFolder}
              onViewDetails={onViewDetailsFolder}
              onTrash={onTrashFolder}
              onRestore={onRestoreFolder}
              onDeleteForever={onDeleteForeverFolder}
            />
          }
        />
      ))}

      {files.map(file => (
        <ItemCard
          key={file.id}
          icon={resolveFileIcon(file)}
          name={file.fileName}
          updatedAt={file.updatedAt}
          menu={
            <FileContextMenuContent
              file={file}
              onOpenFile={onOpenFile}
              onRename={onRenameFile}
              onMove={onMoveFile}
              onViewDetails={onViewDetailsFile}
              onTrash={onTrashFile}
              onRestore={onRestoreFile}
              onDeleteForever={onDeleteForeverFile}
            />
          }
        />
      ))}
    </div>
  )
}
