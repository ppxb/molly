import type { ReactNode } from 'react'
import { FolderIcon } from 'lucide-react'

import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  FileContextMenuContent,
  FolderContextMenuContent
} from '@/features/file-browser/components/entry-context-menu-content'
import { type EntryActionProps, resolveFileIcon } from '@/features/file-browser/components/entry-grid-view'
import type { UploadFolderRecord, UploadedFileRecord } from '@/lib/upload/shared'
import { formatBytes, formatDateTime } from '@/lib/utils'

interface EntryTableViewProps extends EntryActionProps {
  folders: UploadFolderRecord[]
  files: UploadedFileRecord[]
}

function EntryNameCell({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="shrink-0">{icon}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  )
}

export function EntryTableView({
  folders,
  files,
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
  onDeleteForeverFolder
}: EntryTableViewProps) {
  return (
    <div className="border">
      <Table className="min-w-180 table-fixed">
        <TableHeader className="bg-muted/30">
          <TableRow className="text-left text-xs text-muted-foreground hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead className="w-48">Created Time</TableHead>
            <TableHead className="w-36">Size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map(folder => (
            <ContextMenu key={folder.id}>
              <ContextMenuTrigger asChild>
                <TableRow
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={onNavigate ? () => onNavigate(folder.id) : undefined}
                >
                  <TableCell className="max-w-0">
                    <EntryNameCell icon={<FolderIcon className="size-5 text-amber-500" />} value={folder.folderName} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(folder.createdAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">-</TableCell>
                </TableRow>
              </ContextMenuTrigger>
              <FolderContextMenuContent
                folder={folder}
                onRename={onRenameFolder}
                onMove={onMoveFolder}
                onViewDetails={onViewDetailsFolder}
                onTrash={onTrashFolder}
                onRestore={onRestoreFolder}
                onDeleteForever={onDeleteForeverFolder}
              />
            </ContextMenu>
          ))}

          {files.map(file => (
            <ContextMenu key={file.id}>
              <ContextMenuTrigger asChild>
                <TableRow className="hover:bg-muted/40">
                  <TableCell className="max-w-0">
                    <EntryNameCell icon={resolveFileIcon(file)} value={file.fileName} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateTime(file.createdAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatBytes(file.fileSize)}</TableCell>
                </TableRow>
              </ContextMenuTrigger>
              <FileContextMenuContent
                file={file}
                onOpenFile={onOpenFile}
                onRename={onRenameFile}
                onMove={onMoveFile}
                onViewDetails={onViewDetailsFile}
                onTrash={onTrashFile}
                onRestore={onRestoreFile}
                onDeleteForever={onDeleteForeverFile}
              />
            </ContextMenu>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
