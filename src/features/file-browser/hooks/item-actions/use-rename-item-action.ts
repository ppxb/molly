import { useCallback, useState, type MutableRefObject } from 'react'
import { toast } from 'sonner'

import { getErrorMessage, updateFileRequest } from '@/lib/drive/api'
import type { DriveFolderRecord, DriveFileRecord } from '@/lib/drive/types'

import type { RenameTarget } from './types'

interface UseRenameItemActionInput {
  currentFolderIdRef: MutableRefObject<string>
  loadEntries: (folderId: string) => Promise<void>
}

export function useRenameItemAction({ currentFolderIdRef, loadEntries }: UseRenameItemActionInput) {
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)

  const submitRename = useCallback(
    async (nextName: string) => {
      if (!renameTarget) {
        return
      }

      setIsRenaming(true)
      try {
        await updateFileRequest({
          file_id: renameTarget.id,
          name: nextName,
          check_name_mode: 'refuse'
        })
        toast.success(renameTarget.type === 'file' ? 'File renamed' : 'Folder renamed')
        setRenameTarget(null)
        await loadEntries(currentFolderIdRef.current)
      } catch (error) {
        toast.error(getErrorMessage(error, 'Failed to rename'))
      } finally {
        setIsRenaming(false)
      }
    },
    [currentFolderIdRef, loadEntries, renameTarget]
  )

  const onRenameFile = useCallback((file: DriveFileRecord) => {
    setRenameTarget({
      id: file.id,
      type: 'file',
      name: file.fileName
    })
  }, [])

  const onRenameFolder = useCallback((folder: DriveFolderRecord) => {
    setRenameTarget({
      id: folder.id,
      type: 'folder',
      name: folder.folderName
    })
  }, [])

  const onRenameDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setRenameTarget(null)
    }
  }, [])

  return {
    renameTarget,
    isRenaming,
    submitRename,
    onRenameDialogOpenChange,
    onRenameFile,
    onRenameFolder
  }
}
