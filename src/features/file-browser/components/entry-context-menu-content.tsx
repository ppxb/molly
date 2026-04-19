import { ArrowDownToLine, Trash2Icon } from 'lucide-react'

import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import type { UploadFolderRecord, UploadedFileRecord } from '@/lib/upload/shared'

interface FolderContextMenuContentProps {
  folder: UploadFolderRecord
  onRename?: (folder: UploadFolderRecord) => void
  onMove?: (folder: UploadFolderRecord) => void
  onViewDetails?: (folder: UploadFolderRecord) => void
  onTrash?: (folder: UploadFolderRecord) => void
  onRestore?: (folder: UploadFolderRecord) => void
  onDeleteForever?: (folder: UploadFolderRecord) => void
}

interface FileContextMenuContentProps {
  file: UploadedFileRecord
  onOpenFile?: (fileId: string, mode: 'preview' | 'download') => void
  onRename?: (file: UploadedFileRecord) => void
  onMove?: (file: UploadedFileRecord) => void
  onViewDetails?: (file: UploadedFileRecord) => void
  onTrash?: (file: UploadedFileRecord) => void
  onRestore?: (file: UploadedFileRecord) => void
  onDeleteForever?: (file: UploadedFileRecord) => void
}

export function FolderContextMenuContent({
  folder,
  onRename,
  onMove,
  onViewDetails,
  onTrash,
  onRestore,
  onDeleteForever
}: FolderContextMenuContentProps) {
  const hasPrimaryActions = Boolean(onRename || onMove || onViewDetails)
  const hasTrashAction = Boolean(onTrash)

  return (
    <ContextMenuContent>
      {onRename ? <ContextMenuItem onSelect={() => onRename(folder)}>Rename</ContextMenuItem> : null}
      {onMove ? <ContextMenuItem onSelect={() => onMove(folder)}>Move</ContextMenuItem> : null}
      {onViewDetails ? <ContextMenuItem onSelect={() => onViewDetails(folder)}>View Details</ContextMenuItem> : null}

      {onTrash ? (
        <>
          {hasPrimaryActions ? <ContextMenuSeparator /> : null}
          <ContextMenuItem variant="destructive" onSelect={() => onTrash(folder)}>
            <Trash2Icon className="size-3.5" />
            Move To Recycle Bin
          </ContextMenuItem>
        </>
      ) : null}

      {onRestore ? (
        <>
          {hasPrimaryActions || hasTrashAction ? <ContextMenuSeparator /> : null}
          <ContextMenuItem onSelect={() => onRestore(folder)}>Restore</ContextMenuItem>
        </>
      ) : null}

      {onDeleteForever ? (
        <>
          {hasPrimaryActions || hasTrashAction || onRestore ? <ContextMenuSeparator /> : null}
          <ContextMenuItem variant="destructive" onSelect={() => onDeleteForever(folder)}>
            Delete Forever
          </ContextMenuItem>
        </>
      ) : null}
    </ContextMenuContent>
  )
}

export function FileContextMenuContent({
  file,
  onOpenFile,
  onRename,
  onMove,
  onViewDetails,
  onTrash,
  onRestore,
  onDeleteForever
}: FileContextMenuContentProps) {
  const hasPrimaryActions = Boolean(onOpenFile || onRename || onMove || onViewDetails)
  const hasTrashAction = Boolean(onTrash)

  return (
    <ContextMenuContent>
      {onOpenFile ? (
        <ContextMenuItem onSelect={() => onOpenFile(file.id, 'download')}>
          <ArrowDownToLine className="size-3.5" />
          Download
        </ContextMenuItem>
      ) : null}
      {onRename ? <ContextMenuItem onSelect={() => onRename(file)}>Rename</ContextMenuItem> : null}
      {onMove ? <ContextMenuItem onSelect={() => onMove(file)}>Move</ContextMenuItem> : null}
      {onViewDetails ? <ContextMenuItem onSelect={() => onViewDetails(file)}>View Details</ContextMenuItem> : null}

      {onTrash ? (
        <>
          {hasPrimaryActions ? <ContextMenuSeparator /> : null}
          <ContextMenuItem variant="destructive" onSelect={() => onTrash(file)}>
            <Trash2Icon className="size-3.5" />
            Move To Recycle Bin
          </ContextMenuItem>
        </>
      ) : null}

      {onRestore ? (
        <>
          {hasPrimaryActions || hasTrashAction ? <ContextMenuSeparator /> : null}
          <ContextMenuItem onSelect={() => onRestore(file)}>Restore</ContextMenuItem>
        </>
      ) : null}

      {onDeleteForever ? (
        <>
          {hasPrimaryActions || hasTrashAction || onRestore ? <ContextMenuSeparator /> : null}
          <ContextMenuItem variant="destructive" onSelect={() => onDeleteForever(file)}>
            Delete Forever
          </ContextMenuItem>
        </>
      ) : null}
    </ContextMenuContent>
  )
}
