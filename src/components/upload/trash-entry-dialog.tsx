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

interface TrashEntryDialogProps {
  open: boolean
  isSubmitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void> | void
}

export function TrashEntryDialog({ open, isSubmitting = false, onOpenChange, onConfirm }: TrashEntryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>放入回收站</DialogTitle>
          <DialogDescription>
            10天内可在回收站中找回已删文件。放入回收站的文件仍占用云盘容量，请及时去回收站清理。
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              取消
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={isSubmitting} onClick={() => void onConfirm()}>
            确认放入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
