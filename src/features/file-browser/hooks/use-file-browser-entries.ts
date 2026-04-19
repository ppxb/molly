import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useUploadBrowserStore } from '@/features/file-browser/store/file-browser-store'
import { getErrorMessage, listUploadEntriesRequest, type FileListOrderBy } from '@/lib/upload/client/api'
import type { UploadBreadcrumbItem, UploadedFileRecord } from '@/lib/upload/shared'

function normalizeFolderID(folderId: string) {
  const normalized = folderId.trim()
  return normalized.length > 0 ? normalized : 'root'
}

type ListOrderDirection = 'ASC' | 'DESC'

function resolveOptimisticLocation(input: {
  nextFolderId: string
  currentPath: string
  breadcrumbs: UploadBreadcrumbItem[]
  folderLookup: Map<string, { id: string; name: string; path: string }>
}) {
  const { nextFolderId, currentPath, breadcrumbs, folderLookup } = input

  if (nextFolderId === 'root') {
    return {
      path: '',
      breadcrumbs: [
        {
          id: 'root',
          label: 'root',
          path: ''
        }
      ] satisfies UploadBreadcrumbItem[]
    }
  }

  const breadcrumbIndex = breadcrumbs.findIndex(item => item.id === nextFolderId)
  if (breadcrumbIndex >= 0) {
    const nextBreadcrumbs = breadcrumbs.slice(0, breadcrumbIndex + 1)
    return {
      path: nextBreadcrumbs[nextBreadcrumbs.length - 1]?.path ?? '',
      breadcrumbs: nextBreadcrumbs
    }
  }

  const folder = folderLookup.get(nextFolderId)
  if (folder) {
    const deduped = breadcrumbs.filter(item => item.id !== nextFolderId)
    return {
      path: folder.path,
      breadcrumbs: [
        ...deduped,
        {
          id: folder.id,
          label: folder.name,
          path: folder.path
        }
      ]
    }
  }

  return {
    path: currentPath,
    breadcrumbs
  }
}

export function useFileBrowserEntries() {
  const currentFolderId = useUploadBrowserStore(state => state.currentFolderId)
  const currentPath = useUploadBrowserStore(state => state.currentPath)
  const breadcrumbs = useUploadBrowserStore(state => state.breadcrumbs)
  const folders = useUploadBrowserStore(state => state.folders)
  const files = useUploadBrowserStore(state => state.files)
  const isLoadingEntries = useUploadBrowserStore(state => state.isLoadingEntries)
  const isPanelVisible = useUploadBrowserStore(state => state.isPanelVisible)

  const setEntries = useUploadBrowserStore(state => state.setEntries)
  const setIsLoadingEntries = useUploadBrowserStore(state => state.setIsLoadingEntries)
  const setPanelVisible = useUploadBrowserStore(state => state.setPanelVisible)

  const currentFolderIdRef = useRef(currentFolderId)
  const currentPathRef = useRef(currentPath)
  const breadcrumbsRef = useRef(breadcrumbs)
  const foldersRef = useRef(folders)
  const filesRef = useRef(files)
  const lastLoadRequestRef = useRef(0)
  const [orderBy, setOrderBy] = useState<FileListOrderBy>('name')
  const [orderDirection, setOrderDirection] = useState<ListOrderDirection>('ASC')
  const orderByRef = useRef<FileListOrderBy>(orderBy)
  const orderDirectionRef = useRef<ListOrderDirection>(orderDirection)

  useEffect(() => {
    currentFolderIdRef.current = currentFolderId
  }, [currentFolderId])

  useEffect(() => {
    currentPathRef.current = currentPath
  }, [currentPath])

  useEffect(() => {
    breadcrumbsRef.current = breadcrumbs
  }, [breadcrumbs])

  useEffect(() => {
    foldersRef.current = folders
  }, [folders])

  useEffect(() => {
    filesRef.current = files
  }, [files])

  useEffect(() => {
    orderByRef.current = orderBy
  }, [orderBy])

  useEffect(() => {
    orderDirectionRef.current = orderDirection
  }, [orderDirection])

  const loadEntries = useCallback(
    async (folderId: string) => {
      const targetFolderId = normalizeFolderID(folderId)
      const requestID = lastLoadRequestRef.current + 1
      lastLoadRequestRef.current = requestID

      setIsLoadingEntries(true)
      try {
        const data = await listUploadEntriesRequest(targetFolderId, {
          order_by: orderByRef.current,
          order_direction: orderDirectionRef.current
        })
        if (requestID !== lastLoadRequestRef.current) {
          return
        }

        setEntries({
          folderId: data.folderId,
          path: data.path,
          breadcrumbs: data.breadcrumbs,
          files: data.files,
          folders: data.folders
        })
      } catch (error) {
        if (requestID !== lastLoadRequestRef.current) {
          return
        }
        toast.error(getErrorMessage(error, 'Failed to load folder contents'))
      } finally {
        if (requestID === lastLoadRequestRef.current) {
          setIsLoadingEntries(false)
        }
      }
    },
    [setEntries, setIsLoadingEntries]
  )

  const navigateToFolder = useCallback(
    (folderId: string) => {
      const nextFolderId = normalizeFolderID(folderId)
      if (nextFolderId === currentFolderId) {
        return
      }

      const folderLookup = new Map(
        folders.map(folder => [
          folder.id,
          {
            id: folder.id,
            name: folder.folderName,
            path: folder.folderPath
          }
        ])
      )

      const optimistic = resolveOptimisticLocation({
        nextFolderId,
        currentPath,
        breadcrumbs,
        folderLookup
      })

      setEntries({
        folderId: nextFolderId,
        path: optimistic.path,
        breadcrumbs: optimistic.breadcrumbs,
        files: [],
        folders: []
      })
      setIsLoadingEntries(true)
    },
    [breadcrumbs, currentFolderId, currentPath, folders, setEntries, setIsLoadingEntries]
  )

  const refreshCurrentPath = useCallback(() => {
    void loadEntries(currentFolderId)
  }, [currentFolderId, loadEntries])

  const setListOrderBy = useCallback(
    (nextOrderBy: FileListOrderBy) => {
      if (nextOrderBy === orderByRef.current) {
        return
      }
      setOrderBy(nextOrderBy)
      orderByRef.current = nextOrderBy
      void loadEntries(currentFolderIdRef.current)
    },
    [loadEntries]
  )

  const setListOrderDirection = useCallback(
    (nextDirection: ListOrderDirection) => {
      if (nextDirection === orderDirectionRef.current) {
        return
      }
      setOrderDirection(nextDirection)
      orderDirectionRef.current = nextDirection
      void loadEntries(currentFolderIdRef.current)
    },
    [loadEntries]
  )

  const upsertFileInCurrentFolder = useCallback(
    (file: UploadedFileRecord) => {
      const targetFolderID = normalizeFolderID(file.folderId)
      if (currentFolderIdRef.current !== targetFolderID) {
        return false
      }

      const currentFiles = filesRef.current
      const existingIndex = currentFiles.findIndex(item => item.id === file.id)
      const nextFiles =
        existingIndex >= 0 ? currentFiles.map(item => (item.id === file.id ? file : item)) : [file, ...currentFiles]

      filesRef.current = nextFiles
      setEntries({
        folderId: currentFolderIdRef.current,
        path: currentPathRef.current,
        breadcrumbs: breadcrumbsRef.current,
        folders: foldersRef.current,
        files: nextFiles
      })
      return true
    },
    [setEntries]
  )

  const removeFileFromCurrentFolder = useCallback(
    (fileID: string, folderID: string) => {
      const targetFolderID = normalizeFolderID(folderID)
      if (currentFolderIdRef.current !== targetFolderID) {
        return false
      }

      const currentFiles = filesRef.current
      const nextFiles = currentFiles.filter(item => item.id !== fileID)
      if (nextFiles.length === currentFiles.length) {
        return false
      }

      filesRef.current = nextFiles
      setEntries({
        folderId: currentFolderIdRef.current,
        path: currentPathRef.current,
        breadcrumbs: breadcrumbsRef.current,
        folders: foldersRef.current,
        files: nextFiles
      })
      return true
    },
    [setEntries]
  )

  return {
    currentFolderId,
    currentPath,
    breadcrumbs,
    folders,
    files,
    isLoadingEntries,
    isPanelVisible,
    orderBy,
    orderDirection,
    setCurrentFolderId: navigateToFolder,
    setListOrderBy,
    setListOrderDirection,
    setPanelVisible,
    currentFolderIdRef,
    currentPathRef,
    loadEntries,
    refreshCurrentPath,
    upsertFileInCurrentFolder,
    removeFileFromCurrentFolder
  }
}
