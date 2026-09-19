import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BookDetailPage } from './BookDetailPage'
import { I18nProvider } from '../lib/i18n'
import type { HouseholdBook } from '../lib/types'

function item(): HouseholdBook {
  return {
    id: 'hb1',
    status: 'owned',
    conditionNote: null,
    addedAt: new Date().toISOString(),
    book: {
      id: 'b1',
      title: 'Mistyped Titel',
      isbn13: '9780000000200',
      isbn10: null,
      coverUrl: null,
      volumeNumber: null,
      language: null,
      author: { id: 'a1', name: 'Wrong Author' },
      series: null,
    },
  }
}

function mockFetch(initial: HouseholdBook) {
  let current = initial
  const patchCalls: { url: string; body: unknown }[] = []

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'

      if (method === 'PATCH' && url.includes('/books/')) {
        const body = init?.body ? JSON.parse(init.body as string) : {}
        patchCalls.push({ url, body })
        current = {
          ...current,
          book: {
            ...current.book,
            title: body.title ?? current.book.title,
            author: body.authorName ? { id: 'a1', name: body.authorName } : current.book.author,
            language: body.language || null,
          },
        }
        return { ok: true, status: 200, json: async () => current.book } as Response
      }
      return { ok: true, status: 200, json: async () => current } as Response
    }),
  )

  return { patchCalls }
}

describe('BookDetailPage edit details', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lets you correct wrong title/author/language and shows the correction', async () => {
    const { patchCalls } = mockFetch(item())

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/library/hb1']}>
          <Routes>
            <Route path="/library/:id" element={<BookDetailPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mistyped Titel' })).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Edit details' }))

    const titleInput = screen.getByLabelText('Title')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'The Correct Title')

    const authorInput = screen.getByLabelText(/^Author/)
    await userEvent.clear(authorInput)
    await userEvent.type(authorInput, 'Right Author')

    await userEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'The Correct Title' })).toBeInTheDocument()
    })
    expect(screen.getByText('Right Author')).toBeInTheDocument()
    expect(patchCalls).toHaveLength(1)
    expect(patchCalls[0].url).toContain('/books/b1')
    expect(patchCalls[0].body).toMatchObject({ title: 'The Correct Title', authorName: 'Right Author' })
  })

  it('cancels out of edit mode without saving', async () => {
    mockFetch(item())

    render(
      <I18nProvider>
        <MemoryRouter initialEntries={['/library/hb1']}>
          <Routes>
            <Route path="/library/:id" element={<BookDetailPage />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mistyped Titel' })).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    expect(screen.getByLabelText('Title')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mistyped Titel' })).toBeInTheDocument()
  })
})
