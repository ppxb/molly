import { type ItemActionProps, ItemGridView } from '@/features/file-browser/components/item-grid-view'
import { ItemTableView } from '@/features/file-browser/components/item-table-view'
import type { UploadFolderRecord, UploadedFileRecord } from '@/lib/drive/shared'

export interface ItemBrowserContentProps extends ItemActionProps {
  folders: UploadFolderRecord[]
  files: UploadedFileRecord[]
  viewMode?: 'grid' | 'table'
  emptyMessage?: string
}

export function ItemBrowserContent({
  folders,
  files,
  viewMode = 'grid',
  emptyMessage = 'This folder is empty',
  ...actions
}: ItemBrowserContentProps) {
  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="min-h-65">
        <div className="border border-dashed p-10 text-center text-sm text-muted-foreground">{emptyMessage}</div>
      </div>
    )
  }

  return (
    <div className="min-h-65">
      {viewMode === 'table' ? (
        <ItemTableView folders={folders} files={files} {...actions} />
      ) : (
        <ItemGridView folders={folders} files={files} {...actions} />
      )}
    </div>
  )
}
