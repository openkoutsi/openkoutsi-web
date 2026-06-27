'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import {
  apiFetch,
  setAccessToken,
  clearTokens,
  getAccessToken,
  setSessionCookie,
  clearSessionCookie,
} from './api'
import type { AthleteProfile, TokenPair } from './types'

function parseJwtRoles(token: string): string[] {
  try {
    const payload = token.split('.')[1]
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const data = JSON.parse(decoded)
    return Array.isArray(data.roles) ? data.roles : []
  } catch {
    return []
  }
}

interface AuthState {
  athlete: AthleteProfile | null
  loading: boolean
  roles: string[]
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string, inviteToken: string) => Promise<void>
  logout: () => void
  refreshAthlete: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<string[]>([])

  const fetchAthlete = useCallback(async () => {
    try {
      const data = await apiFetch<AthleteProfile>('/api/athlete')
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (detectedTz && data.app_settings?.timezone !== detectedTz) {
        data.app_settings = { ...data.app_settings, timezone: detectedTz }
        apiFetch('/api/athlete', {
          method: 'PATCH',
          body: JSON.stringify({ app_settings: data.app_settings }),
        }).catch(() => {})
      }
      setAthlete(data)
    } catch {
      setAthlete(null)
    }
  }, [])

  useEffect(() => {
    const restore = async () => {
      if (!getAccessToken()) {
        try {
          const res = await apiFetch<TokenPair>(
            '/api/auth/refresh',
            { method: 'POST' },
            false,
          )
          setAccessToken(res.access_token)
          setRoles(parseJwtRoles(res.access_token))
          setSessionCookie()
        } catch {
          clearTokens()
          setLoading(false)
          return
        }
      } else {
        const existing = getAccessToken()!
        setRoles(parseJwtRoles(existing))
      }
      await fetchAthlete()
      setLoading(false)
    }
    restore()
  }, [fetchAthlete])

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await apiFetch<TokenPair>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ username, password }),
        },
        false,
      )
      setAccessToken(data.access_token)
      setRoles(parseJwtRoles(data.access_token))
      setSessionCookie()
      await fetchAthlete()
    },
    [fetchAthlete],
  )

  const register = useCallback(
    async (username: string, password: string, inviteToken: string) => {
      const data = await apiFetch<TokenPair>(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({ username, password, invite_token: inviteToken }),
        },
        false,
      )
      setAccessToken(data.access_token)
      setRoles(parseJwtRoles(data.access_token))
      setSessionCookie()
      await fetchAthlete()
    },
    [fetchAthlete],
  )

  const logout = useCallback(() => {
    clearTokens()
    clearSessionCookie()
    setAthlete(null)
    setRoles([])
    apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  }, [])

  const refreshAthlete = useCallback(async () => {
    await fetchAthlete()
  }, [fetchAthlete])

  const isAdmin = roles.includes('administrator')

  return (
    <AuthContext.Provider
      value={{ athlete, loading, roles, isAdmin, login, register, logout, refreshAthlete }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
