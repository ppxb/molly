import {
  ArrowDownWideNarrow,
  FilePlusCornerIcon,
  FolderPlusIcon,
  FolderUpIcon,
  Grid2X2,
  List,
  Loader2,
  RefreshCcw
} from 'lucide-react'

import { UploadBreadcrumbNav } from '@/components/upload/upload-breadcrumb-nav'
import { UploadEntryGrid } from '@/components/upload/upload-entry-grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { FileListOrderBy } from '@/lib/upload/client/api'
import type { UploadBreadcrumbItem, UploadFolderRecord, UploadedFileRecord } from '@/lib/upload/shared'

interface UploadedFilesOverviewProps {
  currentFolderId: string
  breadcrumbs: UploadBreadcrumbItem[]
  folders: UploadFolderRecord[]
  files: UploadedFileRecord[]
  isLoading: boolean
  orderBy: FileListOrderBy
  orderDirection: 'ASC' | 'DESC'
  viewMode: 'grid' | 'table'
  onRefresh: () => void
  onChangeOrderBy: (value: FileListOrderBy) => void
  onChangeOrderDirection: (value: 'ASC' | 'DESC') => void
  onChangeViewMode: (value: 'grid' | 'table') => void
  onNavigate: (folderId: string) => void
  onOpenFile: (fileId: string, mode: 'preview' | 'download') => void
  onRenameFile: (file: UploadedFileRecord) => void
  onMoveFile: (file: UploadedFileRecord) => void
  onViewDetailsFile: (file: UploadedFileRecord) => void
  onTrashFile: (file: UploadedFileRecord) => void
  onRenameFolder: (folder: UploadFolderRecord) => void
  onMoveFolder: (folder: UploadFolderRecord) => void
  onViewDetailsFolder: (folder: UploadFolderRecord) => void
  onTrashFolder: (folder: UploadFolderRecord) => void
  onCreateFolder: () => void
  onUploadFiles?: () => void
}

export function UploadedFilesOverview({
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
  onRenameFolder,
  onMoveFolder,
  onViewDetailsFolder,
  onTrashFolder,
  onCreateFolder,
  onUploadFiles
}: UploadedFilesOverviewProps) {
  const orderByLabelMap: Record<FileListOrderBy, string> = {
    name: 'Name',
    created_at: 'Created Time',
    updated_at: 'Updated Time',
    size: 'File Size'
  }

  const orderDirectionLabelMap: Record<'ASC' | 'DESC', string> = {
    ASC: 'Ascending',
    DESC: 'Descending'
  }

  return (
    <TooltipProvider>
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>共 {files.length + folders.length} 项</CardTitle>
              <CardDescription>Single-click folders to open. Right-click files or folders for actions.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" disabled={isLoading}>
                    <ArrowDownWideNarrow className="size-4" />
                    {`Sort: ${orderByLabelMap[orderBy]}`}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={orderBy}
                    onValueChange={value => onChangeOrderBy(value as FileListOrderBy)}
                  >
                    <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="created_at">Created Time</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="updated_at">Updated Time</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="size">File Size</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" disabled={isLoading}>
                    {orderDirectionLabelMap[orderDirection]}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={orderDirection}
                    onValueChange={value => onChangeOrderDirection(value as 'ASC' | 'DESC')}
                  >
                    <DropdownMenuRadioItem value="ASC">Ascending</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="DESC">Descending</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  onClick={() => onChangeViewMode('grid')}
                  disabled={isLoading}
                >
                  <Grid2X2 className="size-4" />
                  Grid
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'table' ? 'default' : 'outline'}
                  onClick={() => onChangeViewMode('table')}
                  disabled={isLoading}
                >
                  <List className="size-4" />
                  Table
                </Button>
              </div>

              <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <UploadBreadcrumbNav currentFolderId={currentFolderId} breadcrumbs={breadcrumbs} onNavigate={onNavigate} />

          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div>
                <UploadEntryGrid
                  folders={folders}
                  files={files}
                  viewMode={viewMode}
                  onNavigate={onNavigate}
                  onOpenFile={onOpenFile}
                  onRenameFile={onRenameFile}
                  onMoveFile={onMoveFile}
                  onViewDetailsFile={onViewDetailsFile}
                  onTrashFile={onTrashFile}
                  onRenameFolder={onRenameFolder}
                  onMoveFolder={onMoveFolder}
                  onViewDetailsFolder={onViewDetailsFolder}
                  onTrashFolder={onTrashFolder}
                />
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => onUploadFiles?.()}>
                <FilePlusCornerIcon className="size-3.5" />
                上传文件
              </ContextMenuItem>
              <ContextMenuItem disabled>
                <FolderUpIcon className="size-3.5" />
                上传文件夹 (即将推出)
              </ContextMenuItem>
              <ContextMenuItem onSelect={onCreateFolder}>
                <FolderPlusIcon className="size-3.5" />
                新建文件夹
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
