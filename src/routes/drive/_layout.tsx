import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/drive/_layout')({
  component: AppLayout
})

function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <nav className="flex gap-4 border-b bg-white p-3 text-sm font-medium">
        <Link to="/drive/home" activeProps={{ className: 'text-primary font-bold' }}>
          Home
        </Link>
        <Link to="/drive/file" activeProps={{ className: 'text-primary font-bold' }}>
          Files
        </Link>
      </nav>
      <Outlet />
    </div>
  )
}
