import { createContext, type ReactNode, useContext, useRef } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'

import type { UploadBreadcrumbItem, UploadedFileRecord, UploadFolderRecord } from '@/lib/upload/shared'

type UploadBrowserState = {
  currentFolderId: string
  currentPath: string
  breadcrumbs: UploadBreadcrumbItem[]
  files: UploadedFileRecord[]
  folders: UploadFolderRecord[]
  isLoadingEntries: boolean
  isPanelVisible: boolean
}

type UploadBrowserActions = {
  setCurrentFolderId: (folderId: string) => void
  setEntries: (entries: {
    folderId: string
    path: string
    breadcrumbs: UploadBreadcrumbItem[]
    files: UploadedFileRecord[]
    folders: UploadFolderRecord[]
  }) => void
  setIsLoadingEntries: (isLoading: boolean) => void
  setPanelVisible: (visible: boolean) => void
}

export type UploadBrowserStoreState = UploadBrowserState & UploadBrowserActions

export type UploadBrowserStore = StoreApi<UploadBrowserStoreState>

const DEFAULT_STATE: UploadBrowserState = {
  currentFolderId: 'root',
  currentPath: '',
  breadcrumbs: [
    {
      id: 'root',
      label: 'root',
      path: ''
    }
  ],
  files: [],
  folders: [],
  isLoadingEntries: false,
  isPanelVisible: false
}

function createUploadBrowserStore(initialState: Partial<UploadBrowserState> = {}): UploadBrowserStore {
  return createStore<UploadBrowserStoreState>()(set => ({
    ...DEFAULT_STATE,
    ...initialState,
    setCurrentFolderId: folderId =>
      set(() => ({
        currentFolderId: folderId
      })),
    setEntries: entries =>
      set(() => ({
        currentFolderId: entries.folderId,
        currentPath: entries.path,
        breadcrumbs: entries.breadcrumbs,
        files: entries.files,
        folders: entries.folders
      })),
    setIsLoadingEntries: isLoading =>
      set(() => ({
        isLoadingEntries: isLoading
      })),
    setPanelVisible: visible =>
      set(() => ({
        isPanelVisible: visible
      }))
  }))
}

const UploadBrowserStoreContext = createContext<UploadBrowserStore | null>(null)

export function UploadBrowserStoreProvider({
  children,
  initialState
}: {
  children: ReactNode
  initialState?: Partial<UploadBrowserState>
}) {
  const storeRef = useRef<UploadBrowserStore | null>(null)

  if (!storeRef.current) {
    storeRef.current = createUploadBrowserStore(initialState)
  }

  return <UploadBrowserStoreContext.Provider value={storeRef.current}>{children}</UploadBrowserStoreContext.Provider>
}

export function useUploadBrowserStore<T>(selector: (state: UploadBrowserStoreState) => T) {
  const store = useContext(UploadBrowserStoreContext)
  if (!store) {
    throw new Error('useUploadBrowserStore must be used within UploadBrowserStoreProvider')
  }

  return useStore(store, selector)
}
