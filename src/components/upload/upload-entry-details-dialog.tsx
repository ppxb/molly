import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { formatBytes } from '@/lib/utils'

interface EntryDetailsTarget {
  id: string
  type: 'file' | 'folder'
  name: string
  location: string
  createdAt: string
  updatedAt: string
}

interface FolderDetailsSummary {
  totalBytes: number
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

function formatDateTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  return date.toLocaleString('zh-CN', { hour12: false })
}

function DetailsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-start gap-3 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="break-all">{value}</div>
    </div>
  )
}

export function UploadEntryDetailsDialog({
  open,
  target,
  isLoadingFolderSummary = false,
  folderSummary = null,
  onOpenChange
}: UploadEntryDetailsDialogProps) {
  const isFolder = target?.type === 'folder'

  const folderInfo = isLoadingFolderSummary
    ? '统计中...'
    : folderSummary
      ? folderSummary.displaySummary ||
        `${formatBytes(folderSummary.totalBytes)}（包含 ${folderSummary.fileCount} 个文件，${folderSummary.folderCount} 个文件夹）`
      : '-'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>详细信息</DialogTitle>
          <DialogDescription>{isFolder ? '查看文件夹的详细信息。' : '查看文件的详细信息。'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <DetailsRow label={isFolder ? '文件夹名' : '文件名'} value={target?.name ?? '-'} />
          {isFolder ? <DetailsRow label="文件夹信息" value={folderInfo} /> : null}
          <DetailsRow label="文件位置" value={target?.location ?? '-'} />
          <DetailsRow label="云端创建时间" value={formatDateTime(target?.createdAt ?? '')} />
          <DetailsRow label="最后修改时间" value={formatDateTime(target?.updatedAt ?? '')} />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button">关闭</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
