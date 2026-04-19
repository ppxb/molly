import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import {
  getErrorMessage,
  recycleBinClearRequest,
  recycleBinDeleteRequest,
  recycleBinRestoreRequest
} from '@/lib/drive/client/api'
import type { UploadFolderRecord, UploadedFileRecord } from '@/lib/drive/shared'

interface DeleteForeverTarget {
  id: string
  type: 'file' | 'folder'
  name: string
}

interface UseUploadRecycleBinActionsInput {
  refresh: () => Promise<void>
  removeItemOptimistic: (target: { id: string; type: 'file' | 'folder' }) => (() => void) | null
  clearAllOptimistic: () => () => void
}

export function useRecycleBinActions(input: UseUploadRecycleBinActionsInput) {
  const { refresh, removeItemOptimistic, clearAllOptimistic } = input
  const [isRestoring, setIsRestoring] = useState(false)
  const [isDeletingForever, setIsDeletingForever] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [deleteForeverTarget, setDeleteForeverTarget] = useState<DeleteForeverTarget | null>(null)
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false)

  const restoreEntry = useCallback(
    async (target: DeleteForeverTarget) => {
      const rollback = removeItemOptimistic({
        id: target.id,
        type: target.type
      })
      setIsRestoring(true)
      try {
        await recycleBinRestoreRequest({
          file_id: target.id
        })
        toast.success(target.type === 'file' ? 'File restored' : 'Folder restored')
        void refresh()
      } catch (error) {
        rollback?.()
        toast.error(getErrorMessage(error, 'Failed to restore item'))
      } finally {
        setIsRestoring(false)
      }
    },
    [refresh, removeItemOptimistic]
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
    const rollback = removeItemOptimistic({
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
  }, [deleteForeverTarget, refresh, removeItemOptimistic])

  const onDeleteForeverDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setDeleteForeverTarget(null)
    }
  }, [])

  const onClearRecycleBin = useCallback(() => {
    setIsClearDialogOpen(true)
  }, [])

  const onClearDialogOpenChange = useCallback((open: boolean) => {
    setIsClearDialogOpen(open)
  }, [])

  const submitClearRecycleBin = useCallback(async () => {
    const rollback = clearAllOptimistic()
    setIsClearing(true)
    setIsClearDialogOpen(false)
    try {
      await recycleBinClearRequest()
      toast.success('Recycle bin cleared')
      void refresh()
    } catch (error) {
      rollback()
      toast.error(getErrorMessage(error, 'Failed to clear recycle bin'))
    } finally {
      setIsClearing(false)
    }
  }, [clearAllOptimistic, refresh])

  return {
    isRestoring,
    isDeletingForever,
    isClearing,
    isClearDialogOpen,
    deleteForeverTarget,
    onRestoreFile,
    onRestoreFolder,
    onDeleteForeverFile,
    onDeleteForeverFolder,
    onClearRecycleBin,
    submitDeleteForever,
    submitClearRecycleBin,
    onDeleteForeverDialogOpenChange,
    onClearDialogOpenChange
  }
}
