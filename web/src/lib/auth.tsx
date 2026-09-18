import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError } from './api'
import type { Household, User } from './types'

interface AuthState {
  user: User | null
  households: Household[]
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: { email: string; password: string; name: string; householdName?: string; inviteCode?: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [households, setHouseholds] = useState<Household[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<{ user: User; households: Household[] }>('/auth/me')
      setUser(me.user)
      setHouseholds(me.households)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null)
        setHouseholds([])
      } else {
        throw err
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ user: User; households: Household[] }>('/auth/login', { email, password })
    setUser(result.user)
    setHouseholds(result.households)
  }, [])

  const register = useCallback(
    async (input: { email: string; password: string; name: string; householdName?: string; inviteCode?: string }) => {
      const result = await api.post<{ user: User; household: Household }>('/auth/register', input)
      setUser(result.user)
      setHouseholds([result.household])
    },
    [],
  )

  const logout = useCallback(async () => {
    await api.post('/auth/logout')
    setUser(null)
    setHouseholds([])
  }, [])

  return (
    <AuthContext.Provider value={{ user, households, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
