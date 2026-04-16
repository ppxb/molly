'use client'

import type { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'

import { TooltipProvider } from '@/components/ui/tooltip'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" enableSystem={true} disableTransitionOnChange>
      <TooltipProvider>{children}</TooltipProvider>
      <Toaster />
    </ThemeProvider>
  )
}
