import { useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { useUploadBrowserStore } from '@/components/upload/stores/upload-browser-store'
import { listUploadEntriesRequest } from '@/lib/upload/client/api'

export function useUploadBrowserEntries() {
  const currentFolderId = useUploadBrowserStore(state => state.currentFolderId)
  const currentPath = useUploadBrowserStore(state => state.currentPath)
  const breadcrumbs = useUploadBrowserStore(state => state.breadcrumbs)
  const folders = useUploadBrowserStore(state => state.folders)
  const files = useUploadBrowserStore(state => state.files)
  const isLoadingEntries = useUploadBrowserStore(state => state.isLoadingEntries)
  const isPanelVisible = useUploadBrowserStore(state => state.isPanelVisible)

  const setCurrentFolderId = useUploadBrowserStore(state => state.setCurrentFolderId)
  const setEntries = useUploadBrowserStore(state => state.setEntries)
  const setIsLoadingEntries = useUploadBrowserStore(state => state.setIsLoadingEntries)
  const setPanelVisible = useUploadBrowserStore(state => state.setPanelVisible)

  const currentFolderIdRef = useRef(currentFolderId)
  const currentPathRef = useRef(currentPath)

  useEffect(() => {
    currentFolderIdRef.current = currentFolderId
  }, [currentFolderId])

  useEffect(() => {
    currentPathRef.current = currentPath
  }, [currentPath])

  const loadEntries = useCallback(
    async (folderId: string) => {
      setIsLoadingEntries(true)
      try {
        const data = await listUploadEntriesRequest(folderId)
        setEntries({
          folderId: data.folderId,
          path: data.path,
          breadcrumbs: data.breadcrumbs,
          files: data.files,
          folders: data.folders
        })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load folder contents')
      } finally {
        setIsLoadingEntries(false)
      }
    },
    [setEntries, setIsLoadingEntries]
  )

  const refreshCurrentPath = useCallback(() => {
    void loadEntries(currentFolderId)
  }, [currentFolderId, loadEntries])

  return {
    currentFolderId,
    currentPath,
    breadcrumbs,
    folders,
    files,
    isLoadingEntries,
    isPanelVisible,
    setCurrentFolderId,
    setPanelVisible,
    currentFolderIdRef,
    currentPathRef,
    loadEntries,
    refreshCurrentPath
  }
}
