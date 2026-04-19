import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const DEFAULT_FOLDER_NAME = 'New Folder'

interface CreateFolderDialogProps {
  open: boolean
  currentPath: string
  isSubmitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (folderName: string) => Promise<void> | void
}

export function CreateFolderDialog({ open, isSubmitting = false, onOpenChange, onConfirm }: CreateFolderDialogProps) {
  const [folderName, setFolderName] = useState(DEFAULT_FOLDER_NAME)

  useEffect(() => {
    if (!open) {
      return
    }

    setFolderName(DEFAULT_FOLDER_NAME)
  }, [open])

  const handleSubmit = async () => {
    const nextName = folderName.trim()
    if (!nextName || isSubmitting) {
      return
    }

    await onConfirm(nextName)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Folder</DialogTitle>
        </DialogHeader>

        <div className="mt-3">
          <Input
            value={folderName}
            onChange={event => setFolderName(event.target.value)}
            placeholder="Enter folder name"
            disabled={isSubmitting}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleSubmit()
              }
            }}
          />
        </div>

        <DialogFooter className="justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || folderName.trim().length === 0}
          >
            {isSubmitting ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
