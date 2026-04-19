import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { createFolderRequest, getErrorMessage } from '@/lib/drive/client/api'

interface UseCreateFolderActionInput {
  currentFolderId: string
  loadEntries: (folderId: string) => Promise<void>
}

export function useCreateFolderAction({ currentFolderId, loadEntries }: UseCreateFolderActionInput) {
  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)

  const createFolder = useCallback(
    async (folderName: string) => {
      const normalizedName = folderName.trim()
      if (!normalizedName) {
        toast.error('Folder name cannot be empty')
        return
      }

      setIsCreatingFolder(true)
      try {
        await createFolderRequest({
          parentFolderId: currentFolderId,
          folderName: normalizedName
        })
        toast.success('Folder created')
        setIsCreateFolderDialogOpen(false)
        await loadEntries(currentFolderId)
      } catch (error) {
        toast.error(getErrorMessage(error, 'Failed to create folder'))
      } finally {
        setIsCreatingFolder(false)
      }
    },
    [currentFolderId, loadEntries]
  )

  return {
    isCreateFolderDialogOpen,
    setIsCreateFolderDialogOpen,
    isCreatingFolder,
    createFolder
  }
}
