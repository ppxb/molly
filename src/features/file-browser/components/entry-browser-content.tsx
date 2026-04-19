import { type EntryActionProps, EntryGridView } from '@/features/file-browser/components/entry-grid-view'
import { EntryTableView } from '@/features/file-browser/components/entry-table-view'
import type { UploadFolderRecord, UploadedFileRecord } from '@/lib/upload/shared'

export interface EntryBrowserContentProps extends EntryActionProps {
  folders: UploadFolderRecord[]
  files: UploadedFileRecord[]
  viewMode?: 'grid' | 'table'
  emptyMessage?: string
}

export function EntryBrowserContent({
  folders,
  files,
  viewMode = 'grid',
  emptyMessage = 'This folder is empty',
  ...actions
}: EntryBrowserContentProps) {
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
        <EntryTableView folders={folders} files={files} {...actions} />
      ) : (
        <EntryGridView folders={folders} files={files} {...actions} />
      )}
    </div>
  )
}
