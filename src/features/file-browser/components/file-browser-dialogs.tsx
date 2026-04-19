import type { NameConflictAction } from '@/lib/drive/upload/types'
import type { DriveFolderRecord } from '@/lib/drive/types'

import { CreateFolderDialog } from '@/features/file-browser/components/create-folder-dialog'
import { MoveItemDialog } from '@/features/file-browser/components/move-item-dialog'
import { RenameItemDialog } from '@/features/file-browser/components/rename-item-dialog'
import { TrashItemDialog } from '@/features/file-browser/components/trash-item-dialog'
import {
  type ItemDetailsTarget,
  type FolderDetailsSummary,
  ItemDetailsDialog
} from '@/features/file-browser/components/item-details-dialog'
import { NameConflictDialog } from '@/features/file-browser/components/name-conflict-dialog'

interface RenameTarget {
  id: string
  type: 'file' | 'folder'
  name: string
}

interface MoveTarget {
  id: string
  type: 'file' | 'folder'
  name: string
  initialTargetFolderId: string
}

interface TrashTarget {
  id: string
  type: 'file' | 'folder'
  name: string
}

interface ActiveNameConflict {
  fileName: string
}

export interface FileBrowserDialogsProps {
  currentPath: string
  isCreateFolderDialogOpen: boolean
  setIsCreateFolderDialogOpen: (open: boolean) => void
  isCreatingFolder: boolean
  createFolder: (folderName: string) => Promise<void>
  renameTarget: RenameTarget | null
  isRenaming: boolean
  submitRename: (nextName: string) => Promise<void>
  onRenameDialogOpenChange: (open: boolean) => void
  moveTarget: MoveTarget | null
  moveTargetFolders: DriveFolderRecord[]
  isLoadingMoveTargets: boolean
  isMoving: boolean
  submitMove: (targetFolderId: string) => Promise<void>
  onMoveDialogOpenChange: (open: boolean) => void
  trashTarget: TrashTarget | null
  isTrashing: boolean
  submitTrash: () => Promise<void>
  onTrashDialogOpenChange: (open: boolean) => void
  detailsTarget: ItemDetailsTarget | null
  isLoadingDetailsSummary: boolean
  folderDetailsSummary: FolderDetailsSummary | null
  onDetailsDialogOpenChange: (open: boolean) => void
  activeNameConflict: ActiveNameConflict | null
  resolveActiveNameConflict: (action: NameConflictAction) => void
}

export function FileBrowserDialogs({
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
}: FileBrowserDialogsProps) {
  return (
    <>
      <CreateFolderDialog
        open={isCreateFolderDialogOpen}
        currentPath={currentPath}
        isSubmitting={isCreatingFolder}
        onOpenChange={setIsCreateFolderDialogOpen}
        onConfirm={createFolder}
      />

      <RenameItemDialog
        open={renameTarget !== null}
        type={renameTarget?.type ?? 'file'}
        currentName={renameTarget?.name ?? ''}
        isSubmitting={isRenaming}
        onOpenChange={onRenameDialogOpenChange}
        onConfirm={submitRename}
      />

      <MoveItemDialog
        open={moveTarget !== null}
        type={moveTarget?.type ?? 'file'}
        name={moveTarget?.name ?? ''}
        initialTargetFolderId={moveTarget?.initialTargetFolderId ?? 'root'}
        folders={moveTargetFolders}
        isLoadingTargets={isLoadingMoveTargets}
        isSubmitting={isMoving}
        onOpenChange={onMoveDialogOpenChange}
        onConfirm={submitMove}
      />

      <TrashItemDialog
        open={trashTarget !== null}
        isSubmitting={isTrashing}
        onOpenChange={onTrashDialogOpenChange}
        onConfirm={submitTrash}
      />

      <ItemDetailsDialog
        open={detailsTarget !== null}
        target={detailsTarget}
        isLoadingFolderSummary={isLoadingDetailsSummary}
        folderSummary={folderDetailsSummary}
        onOpenChange={onDetailsDialogOpenChange}
      />

      <NameConflictDialog
        open={activeNameConflict !== null}
        fileName={activeNameConflict?.fileName ?? ''}
        onOpenChange={open => {
          if (!open) {
            resolveActiveNameConflict('skip')
          }
        }}
        onSelect={resolveActiveNameConflict}
      />
    </>
  )
}
