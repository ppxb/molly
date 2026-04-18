import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface RenameEntryDialogProps {
  open: boolean
  type: 'file' | 'folder'
  currentName: string
  isSubmitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (nextName: string) => Promise<void> | void
}

export function RenameEntryDialog({
  open,
  type,
  currentName,
  isSubmitting = false,
  onOpenChange,
  onConfirm
}: RenameEntryDialogProps) {
  const [name, setName] = useState(currentName)

  const fileNameParts = useMemo(() => {
    if (type !== 'file') {
      return {
        editableName: currentName,
        extension: ''
      }
    }

    const dot = currentName.lastIndexOf('.')
    if (dot <= 0 || dot + 1 >= currentName.length) {
      return {
        editableName: currentName,
        extension: ''
      }
    }

    return {
      editableName: currentName.slice(0, dot),
      extension: currentName.slice(dot)
    }
  }, [currentName, type])

  useEffect(() => {
    if (!open) {
      return
    }

    setName(fileNameParts.editableName)
  }, [fileNameParts.editableName, open])

  const dialogTitle = type === 'file' ? 'Rename File' : 'Rename Folder'
  const placeholder = type === 'file' ? 'Enter file name' : 'Enter folder name'

  const handleSubmit = async () => {
    const nextEditableName = name.trim()
    if (!nextEditableName || isSubmitting) {
      return
    }

    const nextName =
      type === 'file' && fileNameParts.extension ? `${nextEditableName}${fileNameParts.extension}` : nextEditableName

    await onConfirm(nextName)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="mt-3 flex items-center gap-2">
          <Input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={placeholder}
            disabled={isSubmitting}
            className="flex-1"
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
          <Button type="button" disabled={isSubmitting || name.trim().length === 0} onClick={() => void handleSubmit()}>
            {isSubmitting ? 'Saving...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
