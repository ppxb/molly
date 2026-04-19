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

interface ClearRecycleBinDialogProps {
  open: boolean
  isSubmitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void> | void
}

export function ClearRecycleBinDialog({
  open,
  isSubmitting = false,
  onOpenChange,
  onConfirm
}: ClearRecycleBinDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear Recycle Bin</DialogTitle>
          <DialogDescription>
            All items in recycle bin will be permanently deleted and cannot be recovered.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={isSubmitting} onClick={() => void onConfirm()}>
            {isSubmitting ? 'Clearing...' : 'Clear Recycle Bin'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
