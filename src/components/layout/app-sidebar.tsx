import { Link, useMatchRoute } from '@tanstack/react-router'
import { HardDriveIcon } from 'lucide-react'
import type { ComponentProps } from 'react'

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
import { appNavItems } from '@/routes/-navigation'

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const closeMobileSidebar = useAppStore(state => state.closeMobileSidebar)
  const matchRoute = useMatchRoute()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <HardDriveIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Molly Drive</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>主目录</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {appNavItems.map(({ id, to, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton asChild tooltip={label} isActive={!!matchRoute({ to, fuzzy: false })}>
                    <Link to={to} preload="intent" viewTransition onClick={closeMobileSidebar}>
                      <Icon className="size-4" />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
