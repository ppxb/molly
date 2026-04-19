import type { ReactNode } from 'react'
import { ArrowDownToLine, Trash2Icon } from 'lucide-react'

import { ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu'
import type { DriveFolderRecord, DriveFileRecord } from '@/lib/drive/types'

interface BaseContextMenuContentProps<TItem> {
  item: TItem
  onRename?: (item: TItem) => void
  onMove?: (item: TItem) => void
  onViewDetails?: (item: TItem) => void
  onTrash?: (item: TItem) => void
  onRestore?: (item: TItem) => void
  onDeleteForever?: (item: TItem) => void
}

interface FolderContextMenuContentProps {
  folder: DriveFolderRecord
  onRename?: (folder: DriveFolderRecord) => void
  onMove?: (folder: DriveFolderRecord) => void
  onViewDetails?: (folder: DriveFolderRecord) => void
  onTrash?: (folder: DriveFolderRecord) => void
  onRestore?: (folder: DriveFolderRecord) => void
  onDeleteForever?: (folder: DriveFolderRecord) => void
}

interface FileContextMenuContentProps {
  file: DriveFileRecord
  onOpenFile?: (fileId: string, mode: 'preview' | 'download') => void
  onRename?: (file: DriveFileRecord) => void
  onMove?: (file: DriveFileRecord) => void
  onViewDetails?: (file: DriveFileRecord) => void
  onTrash?: (file: DriveFileRecord) => void
  onRestore?: (file: DriveFileRecord) => void
  onDeleteForever?: (file: DriveFileRecord) => void
}

interface SharedMenuActionsProps<TItem> extends BaseContextMenuContentProps<TItem> {
  item: TItem
  hasPrimaryActions: boolean
  leadingActions?: ReactNode
}

function SharedMenuActions<TItem>({
  item,
  hasPrimaryActions,
  leadingActions,
  onRename,
  onMove,
  onViewDetails,
  onTrash,
  onRestore,
  onDeleteForever
}: SharedMenuActionsProps<TItem>) {
  const hasTrashAction = Boolean(onTrash)

  return (
    <ContextMenuContent>
      {leadingActions}
      {onRename ? <ContextMenuItem onSelect={() => onRename(item)}>Rename</ContextMenuItem> : null}
      {onMove ? <ContextMenuItem onSelect={() => onMove(item)}>Move</ContextMenuItem> : null}
      {onViewDetails ? <ContextMenuItem onSelect={() => onViewDetails(item)}>View Details</ContextMenuItem> : null}

      {onTrash ? (
        <>
          {hasPrimaryActions ? <ContextMenuSeparator /> : null}
          <ContextMenuItem variant="destructive" onSelect={() => onTrash(item)}>
            <Trash2Icon className="size-3.5" />
            Move To Recycle Bin
          </ContextMenuItem>
        </>
      ) : null}

      {onRestore ? (
        <>
          {hasPrimaryActions || hasTrashAction ? <ContextMenuSeparator /> : null}
          <ContextMenuItem onSelect={() => onRestore(item)}>Restore</ContextMenuItem>
        </>
      ) : null}

      {onDeleteForever ? (
        <>
          {hasPrimaryActions || hasTrashAction || onRestore ? <ContextMenuSeparator /> : null}
          <ContextMenuItem variant="destructive" onSelect={() => onDeleteForever(item)}>
            Delete Forever
          </ContextMenuItem>
        </>
      ) : null}
    </ContextMenuContent>
  )
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

  return (
    <SharedMenuActions
      item={folder}
      hasPrimaryActions={hasPrimaryActions}
      onRename={onRename}
      onMove={onMove}
      onViewDetails={onViewDetails}
      onTrash={onTrash}
      onRestore={onRestore}
      onDeleteForever={onDeleteForever}
    />
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

  return (
    <SharedMenuActions
      item={file}
      hasPrimaryActions={hasPrimaryActions}
      leadingActions={
        onOpenFile ? (
          <ContextMenuItem onSelect={() => onOpenFile(file.id, 'download')}>
            <ArrowDownToLine className="size-3.5" />
            Download
          </ContextMenuItem>
        ) : null
      }
      onRename={onRename}
      onMove={onMove}
      onViewDetails={onViewDetails}
      onTrash={onTrash}
      onRestore={onRestore}
      onDeleteForever={onDeleteForever}
    />
  )
}
