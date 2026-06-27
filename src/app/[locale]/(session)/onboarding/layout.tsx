'use client'

import { useEffect } from 'react'
import { useRouter } from '@/navigation'
import { useAuth } from '@/lib/auth'
import type { ReactNode } from 'react'

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  const { athlete, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !athlete) {
      router.replace(`/login`)
    }
  }, [athlete, loading, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (!athlete) return null

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {children}
      </div>
    </div>
  )
}
