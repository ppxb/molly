import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { getErrorMessage, listRecycleBinRequest, type RecycleBinListItem } from '@/lib/upload/client/api'
import type { RecycleBinEntriesResponse, RecycleBinFileRecord, RecycleBinFolderRecord } from '@/lib/upload/shared'

function inferFileExtension(input: { name: string; fileExtension?: string }) {
  if (input.fileExtension && input.fileExtension.trim().length > 0) {
    return input.fileExtension.trim().toLowerCase()
  }

  const dotIndex = input.name.lastIndexOf('.')
  if (dotIndex <= 0 || dotIndex + 1 >= input.name.length) {
    return ''
  }

  return input.name.slice(dotIndex + 1).toLowerCase()
}

function mapRecycleFolder(item: RecycleBinListItem): RecycleBinFolderRecord {
  return {
    id: item.file_id,
    folderName: item.name,
    parentId: 'recyclebin',
    folderPath: item.name,
    parentPath: '',
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    trashedAt: item.trashed_at,
    expiresAt: item.gmt_expired
  }
}

function mapRecycleFile(item: RecycleBinListItem): RecycleBinFileRecord {
  const fileName = item.name

  return {
    id: item.file_id,
    fileName,
    fileExtension: inferFileExtension({
      name: fileName,
      fileExtension: item.file_extension
    }),
    folderId: 'recyclebin',
    folderPath: '',
    contentType: 'application/octet-stream',
    fileSize: item.size ?? 0,
    fileHash: item.content_hash ?? '',
    fileSampleHash: '',
    objectKey: '',
    bucket: '',
    strategy: 'single',
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    trashedAt: item.trashed_at,
    expiresAt: item.gmt_expired,
    recycleURL: item.url ?? ''
  }
}

export function useUploadRecycleBinEntries() {
  const [folders, setFolders] = useState<RecycleBinFolderRecord[]>([])
  const [files, setFiles] = useState<RecycleBinFileRecord[]>([])
  const [nextMarker, setNextMarker] = useState('')
  const [isLoadingRecycleBin, setIsLoadingRecycleBin] = useState(false)

  const removeEntryOptimistic = useCallback(
    (target: { id: string; type: 'file' | 'folder' }) => {
      if (target.type === 'folder') {
        const index = folders.findIndex(folder => folder.id === target.id)
        if (index < 0) {
          return null
        }

        const removed = folders[index]
        setFolders(prev => prev.filter(folder => folder.id !== target.id))

        return () => {
          setFolders(prev => {
            if (prev.some(folder => folder.id === removed.id)) {
              return prev
            }
            const next = [...prev]
            const insertAt = Math.min(index, next.length)
            next.splice(insertAt, 0, removed)
            return next
          })
        }
      }

      const index = files.findIndex(file => file.id === target.id)
      if (index < 0) {
        return null
      }

      const removed = files[index]
      setFiles(prev => prev.filter(file => file.id !== target.id))

      return () => {
        setFiles(prev => {
          if (prev.some(file => file.id === removed.id)) {
            return prev
          }
          const next = [...prev]
          const insertAt = Math.min(index, next.length)
          next.splice(insertAt, 0, removed)
          return next
        })
      }
    },
    [files, folders]
  )

  const loadRecycleBinEntries = useCallback(async () => {
    setIsLoadingRecycleBin(true)
    try {
      const data = await listRecycleBinRequest({
        limit: 200
      })

      const mappedFolders: RecycleBinFolderRecord[] = []
      const mappedFiles: RecycleBinFileRecord[] = []
      for (const item of data.items) {
        if (item.type === 'folder') {
          mappedFolders.push(mapRecycleFolder(item))
          continue
        }

        mappedFiles.push(mapRecycleFile(item))
      }

      setFolders(mappedFolders)
      setFiles(mappedFiles)
      setNextMarker(data.next_marker ?? '')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load recycle bin'))
    } finally {
      setIsLoadingRecycleBin(false)
    }
  }, [])

  const clearAllOptimistic = useCallback(() => {
    const previousFolders = folders
    const previousFiles = files

    setFolders([])
    setFiles([])
    setNextMarker('')

    return () => {
      setFolders(previousFolders)
      setFiles(previousFiles)
    }
  }, [files, folders])

  return {
    folders,
    files,
    nextMarker,
    isLoadingRecycleBin,
    loadRecycleBinEntries,
    removeEntryOptimistic,
    clearAllOptimistic
  } satisfies RecycleBinEntriesResponse & {
    isLoadingRecycleBin: boolean
    loadRecycleBinEntries: () => Promise<void>
    removeEntryOptimistic: (target: { id: string; type: 'file' | 'folder' }) => (() => void) | null
    clearAllOptimistic: () => () => void
  }
}
