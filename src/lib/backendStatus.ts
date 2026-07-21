'use client'

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { getApiUrl } from './api'

interface BackendStatusContextValue {
  isBackendDown: boolean
  recheck: () => void
}

const BackendStatusContext = createContext<BackendStatusContextValue>({
  isBackendDown: false,
  recheck: () => {},
})

export function BackendStatusProvider({ children }: { children: React.ReactNode }) {
  const [isBackendDown, setIsBackendDown] = useState(false)

  const check = useCallback(async () => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`${getApiUrl()}/api/health`, {
        signal: controller.signal,
        cache: 'no-store',
      })
      clearTimeout(timeout)
      setIsBackendDown(!res.ok)
    } catch {
      setIsBackendDown(true)
    }
  }, [])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined

    const start = () => {
      if (interval) return
      check()
      interval = setInterval(check, 60_000)
    }
    const stop = () => {
      if (interval) {
        clearInterval(interval)
        interval = undefined
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') start()
      else stop()
    }

    // Only poll while the tab is visible; check immediately on becoming visible.
    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [check])

  return React.createElement(
    BackendStatusContext.Provider,
    { value: { isBackendDown, recheck: check } },
    children,
  )
}

export function useBackendStatus() {
  return useContext(BackendStatusContext)
}
