'use client'

import { ArrowDownToLine, ChevronRight, Eye, FileIcon, FolderIcon, HomeIcon, Loader2, RefreshCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatBytes } from '@/lib/utils'
import type { UploadedFileRecord, UploadFolderRecord } from '@/lib/upload/shared'

interface UploadedFilesOverviewProps {
  currentPath: string
  folders: UploadFolderRecord[]
  files: UploadedFileRecord[]
  isLoading: boolean
  onRefresh: () => void
  onNavigate: (path: string) => void
  onOpenFile: (fileId: string, mode: 'preview' | 'download') => void
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString()
}

function buildPathItems(path: string) {
  const segments = path.split('/').filter(Boolean)
  const items: Array<{ label: string; path: string }> = [{ label: 'root', path: '' }]

  let current = ''
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment
    items.push({
      label: segment,
      path: current
    })
  }

  return items
}

export function UploadedFilesOverview({
  currentPath,
  folders,
  files,
  isLoading,
  onRefresh,
  onNavigate,
  onOpenFile
}: UploadedFilesOverviewProps) {
  const pathItems = buildPathItems(currentPath)
  const isEmpty = folders.length === 0 && files.length === 0

  return (
    <Card className="border-border/70">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>File Explorer</CardTitle>
            <CardDescription>Browse folders and files in the current workspace path.</CardDescription>
          </div>
          <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-1 rounded-none border bg-muted/30 p-2">
          {pathItems.map((item, index) => {
            const isRoot = item.path === ''
            const isCurrent = item.path === currentPath
            return (
              <div key={item.path || 'root'} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="size-3.5 text-muted-foreground" /> : null}
                <Button
                  variant={isCurrent ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => onNavigate(item.path)}
                >
                  {isRoot ? <HomeIcon className="size-3.5" /> : null}
                  {item.label}
                </Button>
              </div>
            )
          })}
        </div>

        {isEmpty ? (
          <div className="rounded-none border border-dashed p-10 text-center text-sm text-muted-foreground">
            This folder is empty.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map(folder => (
              <button
                type="button"
                key={folder.id}
                className="group flex flex-col gap-2 rounded-none border p-3 text-left transition hover:bg-muted/40"
                onDoubleClick={() => onNavigate(folder.folderPath)}
                onClick={() => onNavigate(folder.folderPath)}
              >
                <div className="flex items-center gap-2">
                  <FolderIcon className="size-4 text-amber-500" />
                  <p className="truncate text-sm font-medium">{folder.folderName}</p>
                </div>
                <p className="truncate text-xs text-muted-foreground">Open folder</p>
              </button>
            ))}

            {files.map(file => (
              <div key={file.id} className="flex flex-col gap-3 rounded-none border p-3">
                <div className="flex items-center gap-2">
                  <FileIcon className="size-4 text-muted-foreground" />
                  <p className="truncate text-sm font-medium">{file.fileName}</p>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>{formatBytes(file.fileSize)}</p>
                  <p className="truncate">{formatDateTime(file.createdAt)}</p>
                </div>
                <div className="mt-auto flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onOpenFile(file.id, 'preview')}>
                    <Eye className="size-3.5" />
                    Preview
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onOpenFile(file.id, 'download')}>
                    <ArrowDownToLine className="size-3.5" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
