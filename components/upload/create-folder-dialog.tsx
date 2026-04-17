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

const DEFAULT_FOLDER_NAME = '新建文件夹'

interface CreateFolderDialogProps {
  open: boolean
  currentPath: string
  isSubmitting?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (folderName: string) => Promise<void> | void
}

function getPathLabel(path: string) {
  return path ? `/${path}` : '/'
}

export function CreateFolderDialog({
  open,
  currentPath,
  isSubmitting = false,
  onOpenChange,
  onConfirm
}: CreateFolderDialogProps) {
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
          <DialogTitle>新建文件夹</DialogTitle>
          <DialogDescription>当前目录：{getPathLabel(currentPath)}</DialogDescription>
        </DialogHeader>

        <div className="mt-3">
          <Input
            value={folderName}
            onChange={event => setFolderName(event.target.value)}
            placeholder="请输入文件夹名称"
            disabled={isSubmitting}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleSubmit()
              }
            }}
          />
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSubmitting}>
              取消
            </Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || folderName.trim().length === 0}
          >
            {isSubmitting ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
