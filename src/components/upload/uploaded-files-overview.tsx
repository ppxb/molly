import { FilePlusCornerIcon, FolderPlusIcon, FolderUpIcon, Loader2, RefreshCcw } from 'lucide-react'

import { UploadBreadcrumbNav } from '@/components/upload/upload-breadcrumb-nav'
import { UploadEntryGrid } from '@/components/upload/upload-entry-grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { UploadBreadcrumbItem, UploadFolderRecord, UploadedFileRecord } from '@/lib/upload/shared'

interface UploadedFilesOverviewProps {
  currentFolderId: string
  breadcrumbs: UploadBreadcrumbItem[]
  folders: UploadFolderRecord[]
  files: UploadedFileRecord[]
  isLoading: boolean
  onRefresh: () => void
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
  onRefresh,
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
  return (
    <TooltipProvider>
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>共 {files.length + folders.length} 项</CardTitle>
              <CardDescription>Single-click folders to open. Right-click files or folders for actions.</CardDescription>
            </div>
            <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
              Refresh
            </Button>
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
