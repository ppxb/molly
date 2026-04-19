import { FolderIcon, HardDriveIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { ThemeToggle } from '@/components/toggle-theme'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger
} from '@/components/ui/sidebar'

export type AppPageKey = 'files'

interface AppLayoutProps {
  activePage: AppPageKey
  onChangePage?: (page: AppPageKey) => void
  children: ReactNode
}

const pageMeta: Record<AppPageKey, { title: string; description: string }> = {
  files: {
    title: '文件',
    description: '浏览、上传和管理文件内容'
  }
}

export function AppLayout({ activePage, onChangePage, children }: AppLayoutProps) {
  const currentPage = pageMeta[activePage]

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" isActive={true} tooltip="Molly Drive">
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

        <SidebarFooter>
          <div className="px-2 text-[11px] text-sidebar-foreground/60">Ctrl/Cmd + B 切换侧边栏</div>
        </SidebarFooter>
        <SidebarRail />
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

        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
