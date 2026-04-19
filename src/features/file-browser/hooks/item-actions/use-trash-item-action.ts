import { useCallback, useState, type MutableRefObject } from 'react'
import { toast } from 'sonner'

import { getErrorMessage, recycleBinTrashRequest } from '@/lib/drive/api'
import type { DriveFolderRecord, DriveFileRecord } from '@/lib/drive/types'

import type { BrowserEntriesSnapshot, TrashTarget } from './types'

interface UseTrashItemActionInput extends BrowserEntriesSnapshot {
  currentFolderIdRef: MutableRefObject<string>
  loadEntries: (folderId: string) => Promise<void>
}

export function useTrashItemAction({
  currentFolderIdRef,
  loadEntries,
  currentPath,
  breadcrumbs,
  folders,
  files,
  setEntries
}: UseTrashItemActionInput) {
  const [trashTarget, setTrashTarget] = useState<TrashTarget | null>(null)
  const [isTrashing, setIsTrashing] = useState(false)

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
              restored.splice(Math.min(removedIndex, restored.length), 0, removed)
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
              restored.splice(Math.min(removedIndex, restored.length), 0, removed)
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

  const onTrashFile = useCallback((file: DriveFileRecord) => {
    setTrashTarget({
      id: file.id,
      type: 'file',
      name: file.fileName
    })
  }, [])

  const onTrashFolder = useCallback((folder: DriveFolderRecord) => {
    setTrashTarget({
      id: folder.id,
      type: 'folder',
      name: folder.folderName
    })
  }, [])

  const onTrashDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setTrashTarget(null)
    }
  }, [])

  return {
    trashTarget,
    isTrashing,
    submitTrash,
    onTrashDialogOpenChange,
    onTrashFile,
    onTrashFolder
  }
}
