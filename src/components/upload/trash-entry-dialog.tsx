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
  type: 'file' | 'folder'
  name: string
  isSubmitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void> | void
}

export function TrashEntryDialog({
  open,
  type,
  name,
  isSubmitting = false,
  onOpenChange,
  onConfirm
}: TrashEntryDialogProps) {
  const title = type === 'file' ? 'Move File to Recycle Bin' : 'Move Folder to Recycle Bin'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {`"${name}" will be moved to recycle bin. You can restore it later before it expires.`}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={isSubmitting} onClick={() => void onConfirm()}>
            {isSubmitting ? 'Moving...' : 'Move to Recycle Bin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
