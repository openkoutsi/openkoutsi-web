'use client'

import { AuthProvider } from '@/lib/auth'
import { BackendStatusProvider, useBackendStatus } from '@/lib/backendStatus'
import { MaintenanceView } from '@/components/MaintenanceView'
import type { ReactNode } from 'react'

function BackendStatusGate({ children }: { children: ReactNode }) {
  const { isBackendDown } = useBackendStatus()
  if (isBackendDown) return <MaintenanceView />
  return <>{children}</>
}

export function SessionProviders({ children }: { children: ReactNode }) {
  return (
    <BackendStatusProvider>
      <BackendStatusGate>
        <AuthProvider>{children}</AuthProvider>
      </BackendStatusGate>
    </BackendStatusProvider>
  )
}
