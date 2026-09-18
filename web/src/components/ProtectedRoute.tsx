import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) return <p className="p-6 text-sm text-text-secondary">Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}
