import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WishlistPage } from './WishlistPage'
import { I18nProvider } from '../lib/i18n'
import type { Favorite } from '../lib/types'

function mockFetch({
  favorites,
  onPost,
}: {
  favorites: Favorite[]
  onPost?: (body: unknown) => { status: number; body: unknown }
}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (method === 'POST' && url.includes('/favorites') && onPost) {
        const body = init?.body ? JSON.parse(init.body as string) : undefined
        const result = onPost(body)
        return { ok: result.status < 300, status: result.status, json: async () => result.body } as Response
      }
      if (url.includes('/favorites')) {
        return { ok: true, status: 200, json: async () => favorites } as Response
      }
      // household-books wishlist/hunting queries
      return { ok: true, status: 200, json: async () => [] } as Response
    }),
  )
}

describe('WishlistPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows live owned-count stats and links a series favorite to its series page', async () => {
    mockFetch({
      favorites: [
        { id: 'f1', targetType: 'series', targetId: 's1', name: 'The Lantern Cycle', ownedCount: 2, totalCount: 5 },
        { id: 'f2', targetType: 'author', targetId: 'a1', name: 'Mira Voss', ownedCount: 3 },
      ],
    })

    render(
      <I18nProvider>
        <MemoryRouter>
          <WishlistPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('The Lantern Cycle')).toBeInTheDocument()
    })

    expect(screen.getByText('2 of 5 owned')).toBeInTheDocument()
    expect(screen.getByText('3 owned')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /The Lantern Cycle/ })).toHaveAttribute('href', '/series/s1')
    expect(screen.getByRole('link', { name: /Mira Voss/ })).toHaveAttribute('href', '/library?search=Mira%20Voss')
  })

  it('adds a favorite by name and shows it in the list', async () => {
    mockFetch({
      favorites: [],
      onPost: (body) => ({
        status: 201,
        body: { id: 'new', targetType: (body as { targetType: string }).targetType, targetId: 'x1', name: 'Brandon Sanderson', ownedCount: 0 },
      }),
    })

    render(
      <I18nProvider>
        <MemoryRouter>
          <WishlistPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Watch for something new')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByPlaceholderText('Author or series name'), 'Brandon Sanderson')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(screen.getByText('Brandon Sanderson')).toBeInTheDocument()
    })
    expect(screen.getByText('0 owned')).toBeInTheDocument()
  })

  it('shows an error when the favorite already exists', async () => {
    mockFetch({
      favorites: [],
      onPost: () => ({ status: 409, body: { error: 'Already a favorite' } }),
    })

    render(
      <I18nProvider>
        <MemoryRouter>
          <WishlistPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Watch for something new')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByPlaceholderText('Author or series name'), 'Mira Voss')
    await userEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => {
      expect(screen.getByText("You're already watching for that.")).toBeInTheDocument()
    })
  })
})
