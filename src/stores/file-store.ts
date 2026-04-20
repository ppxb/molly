import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

export type FileOrderBy = 'name' | 'created_at' | 'updated_at' | 'size'
export type FileOrderDirection = 'ASC' | 'DESC'
export type FileViewMode = 'grid' | 'table'
export type WorkspaceView = 'files' | 'recyclebin'

interface FileStoreState {
  currentFolderId: string
  setCurrentFolderId: (id: string) => void

  activeView: WorkspaceView
  setActiveView: (view: WorkspaceView) => void

  orderBy: FileOrderBy
  orderDirection: FileOrderDirection
  viewMode: FileViewMode
  setOrderBy: (by: FileOrderBy) => void
  setOrderDirection: (dir: FileOrderDirection) => void
  setViewMode: (mode: FileViewMode) => void
}

export const useFileStore = create<FileStoreState>()(
  persist(
    set => ({
      currentFolderId: 'root',
      setCurrentFolderId: id => set({ currentFolderId: id.trim() || 'root' }),

      activeView: 'files',
      setActiveView: view => set({ activeView: view }),

      orderBy: 'name',
      orderDirection: 'ASC',
      viewMode: 'grid',
      setOrderBy: orderBy => set({ orderBy }),
      setOrderDirection: orderDirection => set({ orderDirection }),
      setViewMode: viewMode => set({ viewMode })
    }),
    {
      name: 'molly-file',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        orderBy: state.orderBy,
        orderDirection: state.orderDirection,
        viewMode: state.viewMode
      })
    }
  )
)
