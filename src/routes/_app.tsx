import { AppLayout } from '@/components/layout/app-layout'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_app')({
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
})
