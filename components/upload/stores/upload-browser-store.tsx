'use client'

import { createContext, type ReactNode, useContext, useRef } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'

import type { UploadedFileRecord, UploadFolderRecord } from '@/lib/upload/shared'

type UploadBrowserState = {
  currentPath: string
  files: UploadedFileRecord[]
  folders: UploadFolderRecord[]
  isLoadingEntries: boolean
  isPanelVisible: boolean
}

type UploadBrowserActions = {
  setCurrentPath: (path: string) => void
  setEntries: (entries: { files: UploadedFileRecord[]; folders: UploadFolderRecord[] }) => void
  setIsLoadingEntries: (isLoading: boolean) => void
  setPanelVisible: (visible: boolean) => void
}

export type UploadBrowserStoreState = UploadBrowserState & UploadBrowserActions

export type UploadBrowserStore = StoreApi<UploadBrowserStoreState>

const DEFAULT_STATE: UploadBrowserState = {
  currentPath: '',
  files: [],
  folders: [],
  isLoadingEntries: false,
  isPanelVisible: false
}

function createUploadBrowserStore(initialState: Partial<UploadBrowserState> = {}): UploadBrowserStore {
  return createStore<UploadBrowserStoreState>()(set => ({
    ...DEFAULT_STATE,
    ...initialState,
    setCurrentPath: path =>
      set(() => ({
        currentPath: path
      })),
    setEntries: entries =>
      set(() => ({
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
