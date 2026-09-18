import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'
import { AuthProvider } from '../lib/auth'

function mockFetchSequence(responses: { status: number; body?: unknown }[]) {
  let call = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const r = responses[Math.min(call, responses.length - 1)]
      call++
      return { ok: r.status < 300, status: r.status, json: async () => r.body ?? {} } as Response
    }),
  )
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows an error message when login fails', async () => {
    mockFetchSequence([
      { status: 401 }, // initial /auth/me on mount
      { status: 401, body: { error: 'Invalid email or password' } }, // login attempt
    ])

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpass')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    })
  })
})
