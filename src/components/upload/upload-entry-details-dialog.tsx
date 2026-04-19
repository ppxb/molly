import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/utils'

interface EntryDetailsTarget {
  id: string
  type: 'file' | 'folder'
  name: string
  location: string
  createdAt: string
  updatedAt: string
}

interface FolderDetailsSummary {
  size: number
  fileCount: number
  folderCount: number
  displaySummary: string
}

interface UploadEntryDetailsDialogProps {
  open: boolean
  target: EntryDetailsTarget | null
  isLoadingFolderSummary?: boolean
  folderSummary?: FolderDetailsSummary | null
  onOpenChange: (open: boolean) => void
}

function DetailsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-sm break-all">{value}</div>
    </div>
  )
}

function getFolderInfo(isLoading: boolean, summary: FolderDetailsSummary | null | undefined) {
  if (isLoading || !summary) return '-'
  return summary.displaySummary
}

export function UploadEntryDetailsDialog({
  open,
  target,
  isLoadingFolderSummary = false,
  folderSummary = null,
  onOpenChange
}: UploadEntryDetailsDialogProps) {
  if (!target) {
    return <Dialog open={open} onOpenChange={onOpenChange} />
  }

  const isFolder = target.type === 'folder'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>详细信息</DialogTitle>
          <DialogDescription>{isFolder ? '查看文件夹的详细信息。' : '查看文件的详细信息。'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <DetailsRow label={isFolder ? '文件夹名' : '文件名'} value={target.name} />
          {isFolder && <DetailsRow label="文件夹信息" value={getFolderInfo(isLoadingFolderSummary, folderSummary)} />}
          <DetailsRow label="文件位置" value={target.location} />
          <DetailsRow label="云端创建时间" value={formatDateTime(target.createdAt)} />
          <DetailsRow label="最后修改时间" value={formatDateTime(target.updatedAt)} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
