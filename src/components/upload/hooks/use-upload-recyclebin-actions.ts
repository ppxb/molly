import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { getErrorMessage, recycleBinDeleteRequest, recycleBinRestoreRequest } from '@/lib/upload/client/api'
import type { UploadFolderRecord, UploadedFileRecord } from '@/lib/upload/shared'

interface DeleteForeverTarget {
  id: string
  type: 'file' | 'folder'
  name: string
}

interface UseUploadRecycleBinActionsInput {
  refresh: () => Promise<void>
  removeEntryOptimistic: (target: { id: string; type: 'file' | 'folder' }) => (() => void) | null
}

export function useUploadRecycleBinActions(input: UseUploadRecycleBinActionsInput) {
  const { refresh, removeEntryOptimistic } = input
  const [isRestoring, setIsRestoring] = useState(false)
  const [isDeletingForever, setIsDeletingForever] = useState(false)
  const [deleteForeverTarget, setDeleteForeverTarget] = useState<DeleteForeverTarget | null>(null)

  const restoreEntry = useCallback(
    async (target: DeleteForeverTarget) => {
      const rollback = removeEntryOptimistic({
        id: target.id,
        type: target.type
      })
      setIsRestoring(true)
      try {
        await recycleBinRestoreRequest({
          file_id: target.id
        })
        toast.success(target.type === 'file' ? '文件已恢复' : '文件夹已恢复')
        void refresh()
      } catch (error) {
        rollback?.()
        toast.error(getErrorMessage(error, '恢复项目失败'))
      } finally {
        setIsRestoring(false)
      }
    },
    [refresh, removeEntryOptimistic]
  )

  const onRestoreFile = useCallback(
    (file: UploadedFileRecord) => {
      void restoreEntry({
        id: file.id,
        type: 'file',
        name: file.fileName
      })
    },
    [restoreEntry]
  )

  const onRestoreFolder = useCallback(
    (folder: UploadFolderRecord) => {
      void restoreEntry({
        id: folder.id,
        type: 'folder',
        name: folder.folderName
      })
    },
    [restoreEntry]
  )

  const onDeleteForeverFile = useCallback((file: UploadedFileRecord) => {
    setDeleteForeverTarget({
      id: file.id,
      type: 'file',
      name: file.fileName
    })
  }, [])

  const onDeleteForeverFolder = useCallback((folder: UploadFolderRecord) => {
    setDeleteForeverTarget({
      id: folder.id,
      type: 'folder',
      name: folder.folderName
    })
  }, [])

  const submitDeleteForever = useCallback(async () => {
    if (!deleteForeverTarget) {
      return
    }

    const target = deleteForeverTarget
    const rollback = removeEntryOptimistic({
      id: target.id,
      type: target.type
    })

    setIsDeletingForever(true)
    setDeleteForeverTarget(null)
    try {
      await recycleBinDeleteRequest({
        file_id: target.id
      })
      toast.success(target.type === 'file' ? 'File deleted permanently' : 'Folder deleted permanently')
      void refresh()
    } catch (error) {
      rollback?.()
      toast.error(getErrorMessage(error, 'Failed to delete permanently'))
    } finally {
      setIsDeletingForever(false)
    }
  }, [deleteForeverTarget, refresh, removeEntryOptimistic])

  const onDeleteForeverDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDeleteForeverTarget(null)
    }
  }, [])

  return {
    isRestoring,
    isDeletingForever,
    deleteForeverTarget,
    onRestoreFile,
    onRestoreFolder,
    onDeleteForeverFile,
    onDeleteForeverFolder,
    submitDeleteForever,
    onDeleteForeverDialogOpenChange
  }
}
