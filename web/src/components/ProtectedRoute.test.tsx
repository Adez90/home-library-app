import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'
import { AuthProvider } from '../lib/auth'

describe('ProtectedRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('redirects to /login when there is no session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as Response),
    )

    render(
      <MemoryRouter initialEntries={['/library']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login page</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/library" element={<div>Library page</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Login page')).toBeInTheDocument()
    })
  })

  it('renders the protected content when a session exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({ user: { id: 'u1', email: 'a@example.com', name: 'A' }, households: [] }),
          }) as Response,
      ),
    )

    render(
      <MemoryRouter initialEntries={['/library']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<div>Login page</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/library" element={<div>Library page</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Library page')).toBeInTheDocument()
    })
  })
})
