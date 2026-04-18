import { useCallback, useState, type MutableRefObject } from 'react'
import { toast } from 'sonner'

import {
  createFolderRequest,
  getLatestAsyncTaskRequest,
  listMoveTargetsRequest,
  updateFileRequest,
  uploadBatchRequest
} from '@/lib/upload/client/api'
import type { UploadFolderRecord, UploadedFileRecord } from '@/lib/upload/shared'

interface RenameTarget {
  id: string
  type: 'file' | 'folder'
  name: string
}

interface MoveTarget {
  id: string
  type: 'file' | 'folder'
  name: string
  initialTargetFolderId: string
  excludeFolderId?: string
}

interface UseUploadEntryActionsInput {
  currentFolderId: string
  currentFolderIdRef: MutableRefObject<string>
  loadEntries: (folderId: string) => Promise<void>
}

export function useUploadEntryActions(input: UseUploadEntryActionsInput) {
  const { currentFolderId, currentFolderIdRef, loadEntries } = input

  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  const [moveTargetFolders, setMoveTargetFolders] = useState<UploadFolderRecord[]>([])
  const [isLoadingMoveTargets, setIsLoadingMoveTargets] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isMoving, setIsMoving] = useState(false)

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
        toast.error(error instanceof Error ? error.message : 'Failed to create folder')
      } finally {
        setIsCreatingFolder(false)
      }
    },
    [currentFolderId, loadEntries]
  )

  const openMoveDialog = useCallback(async (target: MoveTarget) => {
    setMoveTarget(target)
    setMoveTargetFolders([])
    setIsLoadingMoveTargets(true)

    try {
      const data = await listMoveTargetsRequest(
        target.type === 'folder' && target.excludeFolderId
          ? {
              excludeFolderId: target.excludeFolderId
            }
          : undefined
      )
      setMoveTargetFolders(data.folders)
    } catch (error) {
      setMoveTarget(null)
      toast.error(error instanceof Error ? error.message : 'Failed to load move targets')
    } finally {
      setIsLoadingMoveTargets(false)
    }
  }, [])

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
        toast.error(error instanceof Error ? error.message : 'Failed to rename')
      } finally {
        setIsRenaming(false)
      }
    },
    [currentFolderIdRef, loadEntries, renameTarget]
  )

  const submitMove = useCallback(
    async (targetFolderId: string) => {
      if (!moveTarget) {
        return
      }

      setIsMoving(true)
      try {
        await getLatestAsyncTaskRequest()

        const batch = await uploadBatchRequest({
          resource: 'file',
          requests: [
            {
              id: moveTarget.id,
              method: 'POST',
              url: '/file/move',
              body: {
                file_id: moveTarget.id,
                file_name: moveTarget.name,
                type: moveTarget.type,
                to_parent_file_id: targetFolderId
              }
            }
          ]
        })

        const result = batch.responses[0]
        if (!result || result.status !== 200) {
          const body = result?.body
          const message =
            body && typeof body === 'object' && 'message' in body && typeof body['message'] === 'string'
              ? body['message']
              : 'Failed to move'
          throw new Error(message)
        }

        toast.success(moveTarget.type === 'file' ? 'File moved' : 'Folder moved')
        setMoveTarget(null)
        await loadEntries(currentFolderIdRef.current)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to move')
      } finally {
        setIsMoving(false)
      }
    },
    [currentFolderIdRef, loadEntries, moveTarget]
  )

  const onRenameFile = useCallback((file: UploadedFileRecord) => {
    setRenameTarget({
      id: file.id,
      type: 'file',
      name: file.fileName
    })
  }, [])

  const onRenameFolder = useCallback((folder: UploadFolderRecord) => {
    setRenameTarget({
      id: folder.id,
      type: 'folder',
      name: folder.folderName
    })
  }, [])

  const onMoveFile = useCallback(
    (file: UploadedFileRecord) => {
      void openMoveDialog({
        id: file.id,
        type: 'file',
        name: file.fileName,
        initialTargetFolderId: file.folderId
      })
    },
    [openMoveDialog]
  )

  const onMoveFolder = useCallback(
    (folder: UploadFolderRecord) => {
      void openMoveDialog({
        id: folder.id,
        type: 'folder',
        name: folder.folderName,
        initialTargetFolderId: folder.parentId ?? 'root',
        excludeFolderId: folder.id
      })
    },
    [openMoveDialog]
  )

  const onRenameDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setRenameTarget(null)
    }
  }, [])

  const onMoveDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setMoveTarget(null)
    }
  }, [])

  return {
    isCreateFolderDialogOpen,
    setIsCreateFolderDialogOpen,
    isCreatingFolder,
    createFolder,
    renameTarget,
    isRenaming,
    submitRename,
    onRenameDialogOpenChange,
    onRenameFile,
    onRenameFolder,
    moveTarget,
    moveTargetFolders,
    isLoadingMoveTargets,
    isMoving,
    submitMove,
    onMoveDialogOpenChange,
    onMoveFile,
    onMoveFolder
  }
}
