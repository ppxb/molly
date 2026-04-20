import { Link, useRouterState } from '@tanstack/react-router'
import { HardDriveIcon } from 'lucide-react'
import type { ComponentProps } from 'react'

import { appNavigationItems } from '@/routes/navigation'
import { useAppStore } from '@/stores/app-store'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator
} from '@/components/ui/sidebar'

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const pathname = useRouterState({
    select: state => state.location.pathname
  })
  const closeMobileSidebar = useAppStore(state => state.closeMobileSidebar)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" isActive={pathname === '/'} tooltip="首页">
              <Link to="/" preload="intent" viewTransition onClick={closeMobileSidebar}>
                <HardDriveIcon className="size-4" />
                <span>Molly Drive</span>
              </Link>
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
              {appNavigationItems.map(item => {
                const Icon = item.icon
                const isActive = pathname === item.to

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.navLabel}>
                      <Link to={item.to} preload="intent" viewTransition onClick={closeMobileSidebar}>
                        <Icon className="size-4" />
                        <span>{item.navLabel}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
