import { ClearRecycleBinDialog } from '@/features/file-browser/components/clear-recycle-bin-dialog'
import { DeleteForeverDialog } from '@/features/file-browser/components/delete-forever-dialog'
import { UploadRecycleBinOverview } from '@/features/file-browser/components/recycle-bin-overview'
import type {
  RecycleBinFileRecord,
  RecycleBinFolderRecord,
  UploadFolderRecord,
  UploadedFileRecord
} from '@/lib/upload/shared'

interface DeleteForeverTarget {
  type: 'file' | 'folder'
  name: string
}

interface RecycleBinSectionProps {
  folders: RecycleBinFolderRecord[]
  files: RecycleBinFileRecord[]
  isLoading: boolean
  isRestoring: boolean
  isDeletingForever: boolean
  isClearing: boolean
  isClearDialogOpen: boolean
  deleteForeverTarget: DeleteForeverTarget | null
  onRefresh: () => void
  onClear: () => void
  onRestoreFile: (file: UploadedFileRecord) => void
  onRestoreFolder: (folder: UploadFolderRecord) => void
  onDeleteForeverFile: (file: UploadedFileRecord) => void
  onDeleteForeverFolder: (folder: UploadFolderRecord) => void
  onDeleteForeverDialogOpenChange: (open: boolean) => void
  onConfirmDeleteForever: () => Promise<void>
  onClearDialogOpenChange: (open: boolean) => void
  onConfirmClear: () => Promise<void>
}

export function RecycleBinSection({
  folders,
  files,
  isLoading,
  isRestoring,
  isDeletingForever,
  isClearing,
  isClearDialogOpen,
  deleteForeverTarget,
  onRefresh,
  onClear,
  onRestoreFile,
  onRestoreFolder,
  onDeleteForeverFile,
  onDeleteForeverFolder,
  onDeleteForeverDialogOpenChange,
  onConfirmDeleteForever,
  onClearDialogOpenChange,
  onConfirmClear
}: RecycleBinSectionProps) {
  return (
    <>
      <UploadRecycleBinOverview
        folders={folders}
        files={files}
        isLoading={isLoading}
        isRestoring={isRestoring}
        isClearing={isClearing}
        onRefresh={onRefresh}
        onClear={onClear}
        onRestoreFile={onRestoreFile}
        onRestoreFolder={onRestoreFolder}
        onDeleteForeverFile={onDeleteForeverFile}
        onDeleteForeverFolder={onDeleteForeverFolder}
      />

      <DeleteForeverDialog
        open={deleteForeverTarget !== null}
        type={deleteForeverTarget?.type ?? 'file'}
        name={deleteForeverTarget?.name ?? ''}
        isSubmitting={isDeletingForever}
        onOpenChange={onDeleteForeverDialogOpenChange}
        onConfirm={onConfirmDeleteForever}
      />

      <ClearRecycleBinDialog
        open={isClearDialogOpen}
        isSubmitting={isClearing}
        onOpenChange={onClearDialogOpenChange}
        onConfirm={onConfirmClear}
      />
    </>
  )
}
