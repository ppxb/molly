import { useCallback, useState, type MutableRefObject } from 'react'
import { toast } from 'sonner'

import {
  createBatchItemError,
  getErrorMessage,
  getLatestAsyncTaskRequest,
  listMoveTargetsRequest,
  batchFileRequest
} from '@/lib/drive/api'
import type { DriveFolderRecord, DriveFileRecord } from '@/lib/drive/types'

import type { MoveTarget } from './types'

interface UseMoveItemActionInput {
  currentFolderIdRef: MutableRefObject<string>
  loadEntries: (folderId: string) => Promise<void>
}

export function useMoveItemAction({ currentFolderIdRef, loadEntries }: UseMoveItemActionInput) {
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  const [moveTargetFolders, setMoveTargetFolders] = useState<DriveFolderRecord[]>([])
  const [isLoadingMoveTargets, setIsLoadingMoveTargets] = useState(false)
  const [isMoving, setIsMoving] = useState(false)

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
      toast.error(getErrorMessage(error, 'Failed to load move targets'))
    } finally {
      setIsLoadingMoveTargets(false)
    }
  }, [])

  const submitMove = useCallback(
    async (targetFolderId: string) => {
      if (!moveTarget) {
        return
      }

      setIsMoving(true)
      try {
        await getLatestAsyncTaskRequest()

        const batch = await batchFileRequest({
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
          throw createBatchItemError(result, 'Failed to move')
        }

        toast.success(moveTarget.type === 'file' ? 'File moved' : 'Folder moved')
        setMoveTarget(null)
        await loadEntries(currentFolderIdRef.current)
      } catch (error) {
        toast.error(getErrorMessage(error, 'Failed to move'))
      } finally {
        setIsMoving(false)
      }
    },
    [currentFolderIdRef, loadEntries, moveTarget]
  )

  const onMoveFile = useCallback(
    (file: DriveFileRecord) => {
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
    (folder: DriveFolderRecord) => {
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

  const onMoveDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setMoveTarget(null)
    }
  }, [])

  return {
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
