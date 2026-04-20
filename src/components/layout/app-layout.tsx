import { useMatches } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { AppSidebar } from '@/components/layout/app-sidebar'
import { ThemeToggle } from '@/components/toggle-theme'
import { useAppStore } from '@/stores/app-store'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    title?: string
    description?: string
  }
}

export function AppLayout({ children }: { children: ReactNode }) {
  const matches = useMatches()
  const { title, description } = matches[matches.length - 1].staticData ?? {}
  const sidebarOpen = useAppStore(s => s.sidebarOpen)
  const mobileSidebarOpen = useAppStore(s => s.mobileSidebarOpen)
  const setSidebarOpen = useAppStore(s => s.setSidebarOpen)
  const setMobileSidebarOpen = useAppStore(s => s.setMobileSidebarOpen)

  return (
    <SidebarProvider
      defaultOpen={true}
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      openMobile={mobileSidebarOpen}
      onOpenMobileChange={setMobileSidebarOpen}
    >
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="size-8" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{title}</div>
              <div className="truncate text-xs text-muted-foreground">{description}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
