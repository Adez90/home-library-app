import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LibraryPage } from './LibraryPage'
import { I18nProvider } from '../lib/i18n'
import type { HouseholdBook } from '../lib/types'

function book(id: string, title: string): HouseholdBook {
  return {
    id,
    status: 'owned',
    conditionNote: null,
    addedAt: new Date().toISOString(),
    book: {
      id: `book-${id}`,
      title,
      isbn13: null,
      isbn10: null,
      coverUrl: `https://example.com/${id}.jpg`,
      volumeNumber: null,
      language: 'en',
      author: { id: 'a1', name: 'Mira Voss' },
      series: null,
    },
  }
}

function mockFetch(items: HouseholdBook[]) {
  const deletedIds: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (method === 'DELETE') {
        const id = url.split('/').pop()!
        deletedIds.push(id)
        return { ok: true, status: 204, json: async () => undefined } as Response
      }
      return { ok: true, status: 200, json: async () => items } as Response
    }),
  )
  return deletedIds
}

describe('LibraryPage bulk remove', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lets the user select multiple books and remove them together', async () => {
    const items = [book('hb1', 'The Ember Road'), book('hb2', 'The Lantern Cycle')]
    const deletedIds = mockFetch(items)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <I18nProvider>
        <MemoryRouter>
          <LibraryPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('The Ember Road').length).toBeGreaterThan(0)
    })

    await userEvent.click(screen.getByRole('button', { name: 'Select' }))

    const buttons = screen.getAllByRole('button', { pressed: false })
    await userEvent.click(buttons[0])
    await userEvent.click(buttons[1])

    expect(screen.getByText('2 selected')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() => {
      expect(deletedIds.sort()).toEqual(['hb1', 'hb2'])
    })

    await waitFor(() => {
      expect(screen.queryByText('2 selected')).not.toBeInTheDocument()
    })
  })

  it('cancels select mode without deleting anything', async () => {
    const items = [book('hb1', 'The Ember Road')]
    const deletedIds = mockFetch(items)

    render(
      <I18nProvider>
        <MemoryRouter>
          <LibraryPage />
        </MemoryRouter>
      </I18nProvider>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('The Ember Road').length).toBeGreaterThan(0)
    })

    await userEvent.click(screen.getByRole('button', { name: 'Select' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('link', { name: /The Ember Road/i })).toBeInTheDocument()
    expect(deletedIds).toHaveLength(0)
  })
})
