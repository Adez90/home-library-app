import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/library')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-svh flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl p-8">
        <h1 className="font-heading text-2xl font-bold mb-1">Welcome back</h1>
        <p className="text-sm text-text-secondary mb-6">Log in to your household library.</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
            />
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-text text-white font-semibold py-2.5 text-sm disabled:opacity-60"
          >
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-text-secondary text-center">
          New here?{' '}
          <Link to="/register" className="text-accent font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
