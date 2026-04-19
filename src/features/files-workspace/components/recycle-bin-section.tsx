import { ClearRecycleBinDialog } from '@/features/file-browser/components/clear-recycle-bin-dialog'
import { DeleteForeverDialog } from '@/features/file-browser/components/delete-forever-dialog'
import { RecycleBinOverview } from '@/features/file-browser/components/recycle-bin-overview'
import { useFilesWorkspace } from '@/features/files-workspace/files-workspace-provider'

export function RecycleBinSection() {
  const { recycleBinSection } = useFilesWorkspace()

  return (
    <>
      <RecycleBinOverview
        folders={recycleBinSection.folders}
        files={recycleBinSection.files}
        isLoading={recycleBinSection.isLoading}
        isRestoring={recycleBinSection.isRestoring}
        isClearing={recycleBinSection.isClearing}
        onRefresh={recycleBinSection.onRefresh}
        onClear={recycleBinSection.onClear}
        onRestoreFile={recycleBinSection.onRestoreFile}
        onRestoreFolder={recycleBinSection.onRestoreFolder}
        onDeleteForeverFile={recycleBinSection.onDeleteForeverFile}
        onDeleteForeverFolder={recycleBinSection.onDeleteForeverFolder}
      />

      <DeleteForeverDialog
        open={recycleBinSection.deleteForeverTarget !== null}
        type={recycleBinSection.deleteForeverTarget?.type ?? 'file'}
        name={recycleBinSection.deleteForeverTarget?.name ?? ''}
        isSubmitting={recycleBinSection.isDeletingForever}
        onOpenChange={recycleBinSection.onDeleteForeverDialogOpenChange}
        onConfirm={recycleBinSection.onConfirmDeleteForever}
      />

      <ClearRecycleBinDialog
        open={recycleBinSection.isClearDialogOpen}
        isSubmitting={recycleBinSection.isClearing}
        onOpenChange={recycleBinSection.onClearDialogOpenChange}
        onConfirm={recycleBinSection.onConfirmClear}
      />
    </>
  )
}
