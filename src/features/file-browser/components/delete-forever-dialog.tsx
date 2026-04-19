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

interface DeleteForeverDialogProps {
  open: boolean
  type: 'file' | 'folder'
  name: string
  isSubmitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void> | void
}

export function DeleteForeverDialog({
  open,
  type,
  name,
  isSubmitting = false,
  onOpenChange,
  onConfirm
}: DeleteForeverDialogProps) {
  const title = type === 'file' ? 'Delete File Forever' : 'Delete Folder Forever'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {`"${name}" will be permanently deleted from recycle bin and cannot be recovered.`}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={isSubmitting} onClick={() => void onConfirm()}>
            {isSubmitting ? 'Deleting...' : 'Delete Forever'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
