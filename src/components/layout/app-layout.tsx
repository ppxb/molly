import { useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { AppSidebar } from '@/components/layout/app-sidebar'
import { ThemeToggle } from '@/components/toggle-theme'
import { getAppNavigationItem } from '@/routes/navigation'
import { useAppStore } from '@/stores/app-store'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = useRouterState({
    select: state => state.location.pathname
  })
  const sidebarOpen = useAppStore(state => state.sidebarOpen)
  const mobileSidebarOpen = useAppStore(state => state.mobileSidebarOpen)
  const setSidebarOpen = useAppStore(state => state.setSidebarOpen)
  const setMobileSidebarOpen = useAppStore(state => state.setMobileSidebarOpen)

  const currentPage = getAppNavigationItem(pathname)
  const content = (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {currentPage.renderSecondarySidebar ? (
        <aside className="hidden w-72 shrink-0 border-r border-border/70 bg-muted/20 md:block">
          {currentPage.renderSecondarySidebar()}
        </aside>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )

  const shellContent = currentPage.renderShell ? currentPage.renderShell(content) : content

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
              <div className="truncate text-sm font-semibold">{currentPage.title}</div>
              <div className="truncate text-xs text-muted-foreground">{currentPage.description}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        {shellContent}
      </SidebarInset>
    </SidebarProvider>
  )
}
