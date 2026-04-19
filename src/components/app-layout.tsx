import { FolderIcon, HardDriveIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { ThemeToggle } from '@/components/toggle-theme'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger
} from '@/components/ui/sidebar'

export type AppPageKey = 'files'

interface AppLayoutProps {
  activePage: AppPageKey
  onChangePage?: (page: AppPageKey) => void
  secondarySidebar?: ReactNode
  children: ReactNode
}

const pageMeta: Record<AppPageKey, { title: string; description: string }> = {
  files: {
    title: '文件',
    description: '浏览、上传和管理文件内容'
  }
}

export function AppLayout({ activePage, onChangePage, secondarySidebar, children }: AppLayoutProps) {
  const currentPage = pageMeta[activePage]

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" isActive={true}>
                <HardDriveIcon className="size-4" />
                <span>Molly Drive</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={activePage === 'files'}
                    tooltip="文件"
                    onClick={() => onChangePage?.('files')}
                  >
                    <FolderIcon className="size-4" />
                    <span>文件</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

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

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {secondarySidebar ? (
            <aside className="hidden w-72 shrink-0 border-r border-border/70 bg-muted/20 md:block">
              {secondarySidebar}
            </aside>
          ) : null}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
