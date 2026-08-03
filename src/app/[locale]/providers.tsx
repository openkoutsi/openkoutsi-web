'use client'

import { ThemeProvider } from 'next-themes'
import { SWRConfig } from 'swr'
import { fetcher } from '@/lib/api'
import { ResumeRevalidator } from '@/components/ResumeRevalidator'
import { Toaster } from '@/components/ui/toaster'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="light-warm" disableTransitionOnChange>
      {/* `revalidateOnFocus` stays off: it fires on every window focus, which
          on desktop means a refetch each time the user clicks back into the
          browser. `ResumeRevalidator` covers what actually matters — the app
          coming back from the background — and unlike SWR's focus handling it
          also listens for `pageshow`, which is the only reliable resume signal
          in an iOS Home Screen web app. */}
      <SWRConfig value={{ fetcher, revalidateOnFocus: false }}>
        <ResumeRevalidator />
        {children}
        <Toaster />
      </SWRConfig>
    </ThemeProvider>
  )
}
