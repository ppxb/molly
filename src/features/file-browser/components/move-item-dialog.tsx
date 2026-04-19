import { useEffect, useMemo, useState } from 'react'
import { CheckIcon, FolderIcon, Loader2 } from 'lucide-react'

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
import type { UploadFolderRecord } from '@/lib/drive/shared'
import { cn } from '@/lib/utils'

interface MoveItemDialogProps {
  open: boolean
  type: 'file' | 'folder'
  name: string
  initialTargetFolderId: string
  folders: UploadFolderRecord[]
  isLoadingTargets?: boolean
  isSubmitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (targetFolderId: string) => Promise<void> | void
}

function formatFolderPath(path: string) {
  return path ? `/${path}` : '/'
}

export function MoveItemDialog({
  open,
  type,
  name,
  initialTargetFolderId,
  folders,
  isLoadingTargets = false,
  isSubmitting = false,
  onOpenChange,
  onConfirm
}: MoveItemDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState(initialTargetFolderId)

  useEffect(() => {
    if (!open) {
      return
    }

    setSelectedFolderId(initialTargetFolderId)
  }, [initialTargetFolderId, open])

  const selectedFolder = useMemo(
    () => folders.find(folder => folder.id === selectedFolderId) ?? null,
    [folders, selectedFolderId]
  )

  const dialogTitle = type === 'file' ? 'Move File' : 'Move Folder'
  const dialogDescription =
    type === 'file'
      ? `Select the destination folder for "${name}"`
      : `Select the destination parent folder for "${name}"`

  const handleSubmit = async () => {
    if (isSubmitting || isLoadingTargets) {
      return
    }

    await onConfirm(selectedFolderId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto border">
          {isLoadingTargets ? (
            <div className="flex items-center justify-center gap-2 p-6 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading available targets...
            </div>
          ) : folders.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No available target folders.</div>
          ) : (
            <div className="divide-y">
              {folders.map(folder => {
                const isSelected = folder.id === selectedFolderId
                return (
                  <button
                    type="button"
                    key={folder.id}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-muted/40',
                      isSelected ? 'bg-muted/60' : ''
                    )}
                    onClick={() => setSelectedFolderId(folder.id)}
                  >
                    <FolderIcon className="size-3.5 text-amber-500" />
                    <span className="flex-1 truncate">{formatFolderPath(folder.folderPath)}</span>
                    {isSelected ? <CheckIcon className="size-3.5" /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Selected: {selectedFolder ? formatFolderPath(selectedFolder.folderPath) : '/'}
        </p>

        <DialogFooter className="justify-end">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting || isLoadingTargets}>
            {isSubmitting ? 'Moving...' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
