import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface AppStoreState {
  sidebarOpen: boolean
  mobileSidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  setMobileSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  closeMobileSidebar: () => void
}

export const useAppStore = create<AppStoreState>()(
  persist(
    set => ({
      sidebarOpen: true,
      mobileSidebarOpen: false,
      setSidebarOpen: open => set({ sidebarOpen: open }),
      setMobileSidebarOpen: open => set({ mobileSidebarOpen: open }),
      toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
      closeMobileSidebar: () => set({ mobileSidebarOpen: false })
    }),
    {
      name: 'molly-app-shell',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        sidebarOpen: state.sidebarOpen
      })
    }
  )
)
