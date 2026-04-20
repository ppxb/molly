import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouter, RouterProvider } from '@tanstack/react-router'

import './styles/globals.css'
import { routeTree } from './routeTree.gen'
import { Providers } from '@/components/providers'
import { AppErrorBoundary } from './components/app-error-boundary'

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 5000,
  scrollRestoration: true
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root') as HTMLElement

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    </AppErrorBoundary>
  </StrictMode>
)
