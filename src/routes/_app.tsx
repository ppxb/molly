import { AppLayout } from '@/components/layout/app-layout'
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth-store'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app')({
  beforeLoad: () => {
    const isAuthenticated = selectIsAuthenticated(useAuthStore.getState())
    if (!isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppRoute
})

function AppRoute() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
