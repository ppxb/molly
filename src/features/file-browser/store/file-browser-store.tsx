import { createContext, type ReactNode, useContext, useRef } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'

import type { DriveBreadcrumbItem, DriveFileRecord, DriveFolderRecord } from '@/lib/drive/types'

type FileBrowserState = {
  currentFolderId: string
  currentPath: string
  breadcrumbs: DriveBreadcrumbItem[]
  files: DriveFileRecord[]
  folders: DriveFolderRecord[]
  isLoadingEntries: boolean
  isPanelVisible: boolean
}

type FileBrowserActions = {
  setCurrentFolderId: (folderId: string) => void
  setEntries: (entries: {
    folderId: string
    path: string
    breadcrumbs: DriveBreadcrumbItem[]
    files: DriveFileRecord[]
    folders: DriveFolderRecord[]
  }) => void
  setIsLoadingEntries: (isLoading: boolean) => void
  setPanelVisible: (visible: boolean) => void
}

export type FileBrowserStoreState = FileBrowserState & FileBrowserActions

export type FileBrowserStore = StoreApi<FileBrowserStoreState>

const DEFAULT_STATE: FileBrowserState = {
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

function createFileBrowserStore(initialState: Partial<FileBrowserState> = {}): FileBrowserStore {
  return createStore<FileBrowserStoreState>()(set => ({
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

const FileBrowserStoreContext = createContext<FileBrowserStore | null>(null)

export function FileBrowserStoreProvider({
  children,
  initialState
}: {
  children: ReactNode
  initialState?: Partial<FileBrowserState>
}) {
  const storeRef = useRef<FileBrowserStore | null>(null)

  if (!storeRef.current) {
    storeRef.current = createFileBrowserStore(initialState)
  }

  return <FileBrowserStoreContext.Provider value={storeRef.current}>{children}</FileBrowserStoreContext.Provider>
}

export function useFileBrowserStore<T>(selector: (state: FileBrowserStoreState) => T) {
  const store = useContext(FileBrowserStoreContext)
  if (!store) {
    throw new Error('useFileBrowserStore must be used within FileBrowserStoreProvider')
  }

  return useStore(store, selector)
}
