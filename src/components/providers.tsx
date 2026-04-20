import { useEffect, type ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster, toast } from 'sonner'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { TooltipProvider } from '@/components/ui/tooltip'
import { ApiError } from '@/api/client'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: error => {
      if ((error as { meta?: { silent?: boolean } }).meta?.silent) return
      toast.error(getToastMessage(error))
    }
  })
})

function getToastMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message || '发生了未知错误'
  return '发生了未知错误'
}

function GlobalErrorListeners() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // ApiError 已经由 QueryCache 处理，不重复 toast
      if (event.error instanceof ApiError) return
      // 忽略已被 ErrorBoundary 捕获的 React 错误
      if (event.error?.stack?.includes('react')) return

      console.error('[Unhandled Error]', event.error)
      toast.error('发生了意外错误，请刷新页面')
    }

    // 注意：不监听 unhandledrejection
    // Promise rejection 由 QueryCache.onError 统一处理
    // 监听它会导致 API 错误被 toast 两次
    window.addEventListener('error', handleError)
    return () => window.removeEventListener('error', handleError)
  }, [])

  return null
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" enableSystem={true} disableTransitionOnChange>
        <GlobalErrorListeners />
        <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
        <Toaster
          toastOptions={{
            classNames: {
              toast: 'rounded-none! font-sans'
            }
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
