import {
  ArrowDownToLine,
  Eye,
  FileArchiveIcon,
  FileAudioIcon,
  FileCodeIcon,
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  FileVideoIcon,
  FolderIcon,
  FolderUpIcon,
  HouseIcon,
  Loader2,
  RefreshCcw,
  FolderPlusIcon,
  FilePlusCornerIcon
} from 'lucide-react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { UploadBreadcrumbItem, UploadedFileRecord, UploadFolderRecord } from '@/lib/upload/shared'
import { cn } from '@/lib/utils'

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
  onRenameFolder: (folder: UploadFolderRecord) => void
  onMoveFolder: (folder: UploadFolderRecord) => void
  onCreateFolder: () => void
  onUploadFiles?: () => void
}

function formatDateTime(iso: string) {
  const date = new Date(iso)
  const pad = (value: number) => `${value}`.padStart(2, '0')
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`
}

function resolveFileIcon(file: UploadedFileRecord) {
  const extension = file.fileExtension.toLowerCase()
  const contentType = file.contentType.toLowerCase()

  if (contentType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension)) {
    return <FileImageIcon className="size-8 text-emerald-500" />
  }

  if (contentType.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(extension)) {
    return <FileVideoIcon className="size-8 text-sky-500" />
  }

  if (contentType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(extension)) {
    return <FileAudioIcon className="size-8 text-cyan-500" />
  }

  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) {
    return <FileArchiveIcon className="size-8 text-amber-500" />
  }

  if (['ts', 'tsx', 'js', 'jsx', 'json', 'css', 'html', 'md', 'py', 'go', 'rs'].includes(extension)) {
    return <FileCodeIcon className="size-8 text-violet-500" />
  }

  if (contentType.startsWith('text/') || ['txt', 'pdf', 'doc', 'docx'].includes(extension)) {
    return <FileTextIcon className="size-8 text-blue-500" />
  }

  return <FileIcon className="size-8 text-muted-foreground" />
}

function NameWithTooltip({ value, className }: { value: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <p className={cn('truncate text-center text-sm font-medium', className)}>{value}</p>
      </TooltipTrigger>
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  )
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
  onRenameFolder,
  onMoveFolder,
  onCreateFolder,
  onUploadFiles
}: UploadedFilesOverviewProps) {
  const pathItems = breadcrumbs
  const isEmpty = folders.length === 0 && files.length === 0

  return (
    <TooltipProvider>
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>File Manager</CardTitle>
              <CardDescription>Double-click folders to open. Right-click files or folders for actions.</CardDescription>
            </div>
            <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="border bg-muted/30 p-2">
            <Breadcrumb>
              <BreadcrumbList className="gap-1.5 sm:gap-1.5">
                {pathItems.map((item, index) => {
                  const isRoot = item.id === 'root'
                  const isCurrent = item.id === currentFolderId
                  const label = isRoot ? 'Home' : item.label

                  return (
                    <BreadcrumbItem key={item.id}>
                      {isCurrent ? (
                        <BreadcrumbPage className="inline-flex items-center font-semibold">
                          <span className="inline-flex items-center gap-1.5">
                            {isRoot ? <HouseIcon className="size-4" aria-hidden="true" /> : null}
                            {label}
                          </span>
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          href="#"
                          className="inline-flex items-center gap-1.5"
                          onClick={event => {
                            event.preventDefault()
                            onNavigate(item.id)
                          }}
                        >
                          {isRoot ? <HouseIcon className="size-4" aria-hidden="true" /> : null}
                          {label}
                        </BreadcrumbLink>
                      )}
                      {index < pathItems.length - 1 ? <BreadcrumbSeparator /> : null}
                    </BreadcrumbItem>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className="min-h-65">
                {isEmpty ? (
                  <div className="border border-dashed p-10 text-center text-sm text-muted-foreground">
                    This folder is empty
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
                    {folders.map(folder => (
                      <ContextMenu key={folder.id}>
                        <ContextMenuTrigger asChild>
                          <button
                            type="button"
                            className="group flex h-40 flex-col items-center justify-center gap-3 border p-4 text-left transition hover:bg-muted/40"
                            onDoubleClick={() => onNavigate(folder.id)}
                          >
                            <FolderIcon className="size-9 text-amber-500" />
                            <NameWithTooltip value={folder.folderName} />
                            <p className="font-mono text-xs text-muted-foreground">
                              {formatDateTime(folder.updatedAt)}
                            </p>
                          </button>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem onSelect={() => onNavigate(folder.id)}>Open</ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem onSelect={() => onRenameFolder(folder)}>Rename</ContextMenuItem>
                          <ContextMenuItem onSelect={() => onMoveFolder(folder)}>Move To</ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}

                    {files.map(file => (
                      <ContextMenu key={file.id}>
                        <ContextMenuTrigger asChild>
                          <button
                            type="button"
                            className="group flex h-40 flex-col items-center justify-center gap-3 border p-4 text-left transition hover:bg-muted/40"
                            onDoubleClick={() => onOpenFile(file.id, 'preview')}
                          >
                            {resolveFileIcon(file)}
                            <NameWithTooltip value={file.fileName} />
                            <p className="font-mono text-xs text-muted-foreground">{formatDateTime(file.updatedAt)}</p>
                          </button>
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem onSelect={() => onOpenFile(file.id, 'preview')}>
                            <Eye className="size-3.5" />
                            Preview
                          </ContextMenuItem>
                          <ContextMenuItem onSelect={() => onOpenFile(file.id, 'download')}>
                            <ArrowDownToLine className="size-3.5" />
                            Download
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem onSelect={() => onRenameFile(file)}>Rename</ContextMenuItem>
                          <ContextMenuItem onSelect={() => onMoveFile(file)}>Move To</ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
                  </div>
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => onUploadFiles?.()}>
                <FilePlusCornerIcon className="size-3.5" />
                Upload Files
              </ContextMenuItem>
              <ContextMenuItem onSelect={onCreateFolder}>
                <FolderPlusIcon className="size-3.5" />
                New Folder
              </ContextMenuItem>
              <ContextMenuItem disabled>
                <FolderUpIcon className="size-3.5" />
                Upload Folder (Coming Soon)
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
