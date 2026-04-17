'use client'

import { useEffect, useState } from 'react'

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

  useEffect(() => {
    if (!open) {
      return
    }

    setName(currentName)
  }, [currentName, open])

  const dialogTitle = type === 'file' ? 'Rename File' : 'Rename Folder'
  const placeholder = type === 'file' ? 'Enter file name' : 'Enter folder name'

  const handleSubmit = async () => {
    const nextName = name.trim()
    if (!nextName || isSubmitting) {
      return
    }

    await onConfirm(nextName)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>Current name: {currentName}</DialogDescription>
        </DialogHeader>

        <div className="mt-3">
          <Input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={placeholder}
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
          <Button type="button" disabled={isSubmitting || name.trim().length === 0} onClick={() => void handleSubmit()}>
            {isSubmitting ? 'Saving...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
