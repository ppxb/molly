import { Loader2, RefreshCcw, Trash2Icon } from 'lucide-react'

import { UploadEntryGrid } from '@/components/upload/upload-entry-grid'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TooltipProvider } from '@/components/ui/tooltip'
import type {
  RecycleBinFileRecord,
  RecycleBinFolderRecord,
  UploadFolderRecord,
  UploadedFileRecord
} from '@/lib/upload/shared'

interface UploadRecycleBinOverviewProps {
  folders: RecycleBinFolderRecord[]
  files: RecycleBinFileRecord[]
  isLoading: boolean
  isRestoring?: boolean
  onRefresh: () => void
  onRestoreFile: (file: UploadedFileRecord) => void
  onRestoreFolder: (folder: UploadFolderRecord) => void
  onDeleteForeverFile: (file: UploadedFileRecord) => void
  onDeleteForeverFolder: (folder: UploadFolderRecord) => void
}

export function UploadRecycleBinOverview({
  folders,
  files,
  isLoading,
  isRestoring = false,
  onRefresh,
  onRestoreFile,
  onRestoreFolder,
  onDeleteForeverFile,
  onDeleteForeverFolder
}: UploadRecycleBinOverviewProps) {
  return (
    <TooltipProvider>
      <Card className="border-border/70">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="inline-flex items-center gap-2">
                <Trash2Icon className="size-4 text-destructive" />
                Recycle Bin
              </CardTitle>
              <CardDescription>
                {isRestoring ? 'Restoring item...' : 'Items moved here can be restored later before expiration.'}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <UploadEntryGrid
            folders={folders}
            files={files}
            onRestoreFile={onRestoreFile}
            onRestoreFolder={onRestoreFolder}
            onDeleteForeverFile={onDeleteForeverFile}
            onDeleteForeverFolder={onDeleteForeverFolder}
            emptyMessage="Recycle bin is empty"
          />
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
