import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { UploadNameConflictAction } from '@/lib/upload/client/upload/types'

interface UploadNameConflictDialogProps {
  open: boolean
  fileName: string
  onOpenChange: (open: boolean) => void
  onSelect: (action: UploadNameConflictAction) => void
}

export function UploadNameConflictDialog({ open, fileName, onOpenChange, onSelect }: UploadNameConflictDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>File name conflict</DialogTitle>
          <DialogDescription>{`A file named "${fileName}" already exists in this folder.`}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onSelect('skip')}>
            Skip
          </Button>
          <Button type="button" variant="destructive" onClick={() => onSelect('overwrite')}>
            Overwrite
          </Button>
          <Button type="button" onClick={() => onSelect('keep_both')}>
            Keep both
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
