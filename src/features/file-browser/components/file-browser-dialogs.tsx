import type { UploadNameConflictAction } from '@/lib/upload/client/upload/types'
import type { UploadFolderRecord } from '@/lib/upload/shared'

import { CreateFolderDialog } from '@/components/upload/create-folder-dialog'
import { MoveEntryDialog } from '@/components/upload/move-entry-dialog'
import { RenameEntryDialog } from '@/components/upload/rename-entry-dialog'
import { TrashEntryDialog } from '@/components/upload/trash-entry-dialog'
import {
  type EntryDetailsTarget,
  type FolderDetailsSummary,
  UploadEntryDetailsDialog
} from '@/components/upload/upload-entry-details-dialog'
import { UploadNameConflictDialog } from '@/components/upload/upload-name-conflict-dialog'

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
  moveTargetFolders: UploadFolderRecord[]
  isLoadingMoveTargets: boolean
  isMoving: boolean
  submitMove: (targetFolderId: string) => Promise<void>
  onMoveDialogOpenChange: (open: boolean) => void
  trashTarget: TrashTarget | null
  isTrashing: boolean
  submitTrash: () => Promise<void>
  onTrashDialogOpenChange: (open: boolean) => void
  detailsTarget: EntryDetailsTarget | null
  isLoadingDetailsSummary: boolean
  folderDetailsSummary: FolderDetailsSummary | null
  onDetailsDialogOpenChange: (open: boolean) => void
  activeNameConflict: ActiveNameConflict | null
  resolveActiveNameConflict: (action: UploadNameConflictAction) => void
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

      <RenameEntryDialog
        open={renameTarget !== null}
        type={renameTarget?.type ?? 'file'}
        currentName={renameTarget?.name ?? ''}
        isSubmitting={isRenaming}
        onOpenChange={onRenameDialogOpenChange}
        onConfirm={submitRename}
      />

      <MoveEntryDialog
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

      <TrashEntryDialog
        open={trashTarget !== null}
        isSubmitting={isTrashing}
        onOpenChange={onTrashDialogOpenChange}
        onConfirm={submitTrash}
      />

      <UploadEntryDetailsDialog
        open={detailsTarget !== null}
        target={detailsTarget}
        isLoadingFolderSummary={isLoadingDetailsSummary}
        folderSummary={folderDetailsSummary}
        onOpenChange={onDetailsDialogOpenChange}
      />

      <UploadNameConflictDialog
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
