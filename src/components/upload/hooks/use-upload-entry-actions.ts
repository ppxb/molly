import { useCallback, useRef, useState, type MutableRefObject } from 'react'
import { toast } from 'sonner'

import { useUploadBrowserStore } from '@/components/upload/stores/upload-browser-store'
import {
  createBatchItemError,
  createFolderRequest,
  getErrorMessage,
  getFolderSizeInfoRequest,
  getLatestAsyncTaskRequest,
  listMoveTargetsRequest,
  recycleBinTrashRequest,
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

interface TrashTarget {
  id: string
  type: 'file' | 'folder'
  name: string
}

interface DetailsTarget {
  id: string
  type: 'file' | 'folder'
  hash?: string
  name: string
  location: string
  createdAt: string
  updatedAt: string
}

interface FolderDetailsSummary {
  size: number
  fileCount: number
  folderCount: number
  displaySummary: string
}

interface UseUploadEntryActionsInput {
  currentFolderId: string
  currentFolderIdRef: MutableRefObject<string>
  loadEntries: (folderId: string) => Promise<void>
}

function toRootLocation(path: string) {
  const normalized = path.trim().replace(/^\/+|\/+$/g, '')
  return normalized ? `root/${normalized}` : 'root'
}

export function useUploadEntryActions(input: UseUploadEntryActionsInput) {
  const { currentFolderId, currentFolderIdRef, loadEntries } = input
  const currentPath = useUploadBrowserStore(state => state.currentPath)
  const breadcrumbs = useUploadBrowserStore(state => state.breadcrumbs)
  const files = useUploadBrowserStore(state => state.files)
  const folders = useUploadBrowserStore(state => state.folders)
  const setEntries = useUploadBrowserStore(state => state.setEntries)

  const [isCreateFolderDialogOpen, setIsCreateFolderDialogOpen] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  const [moveTargetFolders, setMoveTargetFolders] = useState<UploadFolderRecord[]>([])
  const [isLoadingMoveTargets, setIsLoadingMoveTargets] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isMoving, setIsMoving] = useState(false)
  const [trashTarget, setTrashTarget] = useState<TrashTarget | null>(null)
  const [isTrashing, setIsTrashing] = useState(false)
  const [detailsTarget, setDetailsTarget] = useState<DetailsTarget | null>(null)
  const [isLoadingDetailsSummary, setIsLoadingDetailsSummary] = useState(false)
  const [folderDetailsSummary, setFolderDetailsSummary] = useState<FolderDetailsSummary | null>(null)
  const detailsSummaryRequestIDRef = useRef(0)

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

  const submitTrash = useCallback(async () => {
    if (!trashTarget) {
      return
    }

    const target = trashTarget
    const folderIdAtAction = currentFolderIdRef.current
    let rollback: (() => void) | null = null

    if (target.type === 'file') {
      const removedIndex = files.findIndex(file => file.id === target.id)
      if (removedIndex >= 0) {
        const removed = files[removedIndex]
        const nextFiles = files.filter(file => file.id !== target.id)

        setEntries({
          folderId: folderIdAtAction,
          path: currentPath,
          breadcrumbs,
          folders,
          files: nextFiles
        })

        rollback = () => {
          if (currentFolderIdRef.current !== folderIdAtAction) {
            return
          }

          setEntries({
            folderId: folderIdAtAction,
            path: currentPath,
            breadcrumbs,
            folders,
            files: (() => {
              if (nextFiles.some(file => file.id === removed.id)) {
                return nextFiles
              }
              const restored = [...nextFiles]
              const insertAt = Math.min(removedIndex, restored.length)
              restored.splice(insertAt, 0, removed)
              return restored
            })()
          })
        }
      }
    } else {
      const removedIndex = folders.findIndex(folder => folder.id === target.id)
      if (removedIndex >= 0) {
        const removed = folders[removedIndex]
        const nextFolders = folders.filter(folder => folder.id !== target.id)

        setEntries({
          folderId: folderIdAtAction,
          path: currentPath,
          breadcrumbs,
          folders: nextFolders,
          files
        })

        rollback = () => {
          if (currentFolderIdRef.current !== folderIdAtAction) {
            return
          }

          setEntries({
            folderId: folderIdAtAction,
            path: currentPath,
            breadcrumbs,
            folders: (() => {
              if (nextFolders.some(folder => folder.id === removed.id)) {
                return nextFolders
              }
              const restored = [...nextFolders]
              const insertAt = Math.min(removedIndex, restored.length)
              restored.splice(insertAt, 0, removed)
              return restored
            })(),
            files
          })
        }
      }
    }

    setIsTrashing(true)
    setTrashTarget(null)
    try {
      await recycleBinTrashRequest({
        file_id: target.id
      })
      toast.success(target.type === 'file' ? 'File moved to recycle bin' : 'Folder moved to recycle bin')
      if (currentFolderIdRef.current === folderIdAtAction) {
        void loadEntries(folderIdAtAction)
      }
    } catch (error) {
      rollback?.()
      toast.error(getErrorMessage(error, 'Failed to move to recycle bin'))
    } finally {
      setIsTrashing(false)
    }
  }, [breadcrumbs, currentFolderIdRef, currentPath, files, folders, loadEntries, setEntries, trashTarget])

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

  const onTrashFile = useCallback((file: UploadedFileRecord) => {
    setTrashTarget({
      id: file.id,
      type: 'file',
      name: file.fileName
    })
  }, [])

  const onTrashFolder = useCallback((folder: UploadFolderRecord) => {
    setTrashTarget({
      id: folder.id,
      type: 'folder',
      name: folder.folderName
    })
  }, [])

  const onViewDetailsFile = useCallback((file: UploadedFileRecord) => {
    detailsSummaryRequestIDRef.current += 1
    setFolderDetailsSummary(null)
    setIsLoadingDetailsSummary(false)
    setDetailsTarget({
      id: file.id,
      type: 'file',
      hash: file.fileHash,
      name: file.fileName,
      location: toRootLocation(file.folderPath),
      createdAt: file.createdAt,
      updatedAt: file.updatedAt
    })
  }, [])

  const onViewDetailsFolder = useCallback((folder: UploadFolderRecord) => {
    const requestID = detailsSummaryRequestIDRef.current + 1
    detailsSummaryRequestIDRef.current = requestID

    setFolderDetailsSummary(null)
    setIsLoadingDetailsSummary(true)
    setDetailsTarget({
      id: folder.id,
      type: 'folder',
      name: folder.folderName,
      location: toRootLocation(folder.parentPath),
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt
    })

    void (async () => {
      try {
        const summary = await getFolderSizeInfoRequest({
          file_id: folder.id
        })
        if (detailsSummaryRequestIDRef.current !== requestID) {
          return
        }
        setFolderDetailsSummary({
          size: summary.size,
          fileCount: summary.file_count,
          folderCount: summary.folder_count,
          displaySummary: summary.display_summary
        })
      } catch (error) {
        if (detailsSummaryRequestIDRef.current !== requestID) {
          return
        }
        toast.error(getErrorMessage(error, 'Failed to load folder details'))
      } finally {
        if (detailsSummaryRequestIDRef.current === requestID) {
          setIsLoadingDetailsSummary(false)
        }
      }
    })()
  }, [])

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

  const onTrashDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setTrashTarget(null)
    }
  }, [])

  const onDetailsDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      detailsSummaryRequestIDRef.current += 1
      setDetailsTarget(null)
      setFolderDetailsSummary(null)
      setIsLoadingDetailsSummary(false)
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
    onMoveFolder,
    trashTarget,
    isTrashing,
    submitTrash,
    onTrashDialogOpenChange,
    onTrashFile,
    onTrashFolder,
    detailsTarget,
    isLoadingDetailsSummary,
    folderDetailsSummary,
    onDetailsDialogOpenChange,
    onViewDetailsFile,
    onViewDetailsFolder
  }
}
