import { BreadcrumbNav } from '@/features/file-browser/components/breadcrumb-nav'
import { ItemBrowserContent } from '@/features/file-browser/components/item-browser-content'
import { type ItemActionProps } from '@/features/file-browser/components/item-grid-view'
import {
  FileBrowserContextMenuActions,
  FileBrowserToolbar
} from '@/features/file-browser/components/file-browser-toolbar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { FileListOrderBy } from '@/lib/drive/api'
import type { DriveBreadcrumbItem, DriveFolderRecord, DriveFileRecord } from '@/lib/drive/types'

export interface FileBrowserViewProps extends ItemActionProps {
  currentFolderId: string
  breadcrumbs: DriveBreadcrumbItem[]
  folders: DriveFolderRecord[]
  files: DriveFileRecord[]
  isLoading: boolean
  orderBy: FileListOrderBy
  orderDirection: 'ASC' | 'DESC'
  viewMode: 'grid' | 'table'
  onRefresh: () => void
  onChangeOrderBy: (value: FileListOrderBy) => void
  onChangeOrderDirection: (value: 'ASC' | 'DESC') => void
  onChangeViewMode: (value: 'grid' | 'table') => void
  onNavigate: (folderId: string) => void
  onCreateFolder: () => void
  onAddFiles?: () => void
  emptyMessage?: string
}

export function FileBrowserView({
  currentFolderId,
  breadcrumbs,
  folders,
  files,
  isLoading,
  orderBy,
  orderDirection,
  viewMode,
  onRefresh,
  onChangeOrderBy,
  onChangeOrderDirection,
  onChangeViewMode,
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
  onDeleteForeverFolder,
  onCreateFolder,
  onAddFiles,
  emptyMessage = 'This folder is empty'
}: FileBrowserViewProps) {
  return (
    <TooltipProvider>
      <Card className="border-border/70">
        <CardHeader>
          <FileBrowserToolbar
            totalCount={files.length + folders.length}
            isLoading={isLoading}
            orderBy={orderBy}
            orderDirection={orderDirection}
            viewMode={viewMode}
            onRefresh={onRefresh}
            onChangeOrderBy={onChangeOrderBy}
            onChangeOrderDirection={onChangeOrderDirection}
            onChangeViewMode={onChangeViewMode}
          />
        </CardHeader>

        <CardContent className="space-y-4">
          <BreadcrumbNav currentFolderId={currentFolderId} breadcrumbs={breadcrumbs} onNavigate={onNavigate} />

          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div>
                <ItemBrowserContent
                  folders={folders}
                  files={files}
                  viewMode={viewMode}
                  emptyMessage={emptyMessage}
                  onNavigate={onNavigate}
                  onOpenFile={onOpenFile}
                  onRenameFile={onRenameFile}
                  onMoveFile={onMoveFile}
                  onViewDetailsFile={onViewDetailsFile}
                  onTrashFile={onTrashFile}
                  onRestoreFile={onRestoreFile}
                  onDeleteForeverFile={onDeleteForeverFile}
                  onRenameFolder={onRenameFolder}
                  onMoveFolder={onMoveFolder}
                  onViewDetailsFolder={onViewDetailsFolder}
                  onTrashFolder={onTrashFolder}
                  onRestoreFolder={onRestoreFolder}
                  onDeleteForeverFolder={onDeleteForeverFolder}
                />
              </div>
            </ContextMenuTrigger>
            <FileBrowserContextMenuActions onAddFiles={onAddFiles} onCreateFolder={onCreateFolder} />
          </ContextMenu>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
