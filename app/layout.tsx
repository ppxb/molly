import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { Geist, Geist_Mono } from 'next/font/google'

import './globals.css'
import { createMetadata } from '@/lib/metadata'
import { Providers } from '@/components/providers'

const fontSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans'
})

const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono'
})

export const metadata: Metadata = createMetadata({
  title: {
    template: '%s | Molly',
    default: 'Molly'
  },
  description: 'Enterprise-Grade Lightweight Cloud Drive, Ready to Use'
})

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]').setAttribute('content')
                }
              } catch (_) {}
          `
          }}
        ></script>
      </head>
      <body className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>
          <div className="relative min-h-dvh">{children}</div>
        </Providers>
      </body>
    </html>
  )
}
