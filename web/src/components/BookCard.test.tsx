import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BookCard } from './BookCard'
import type { HouseholdBook } from '../lib/types'

const item: HouseholdBook = {
  id: 'hb1',
  status: 'owned',
  conditionNote: null,
  addedAt: new Date().toISOString(),
  book: {
    id: 'b1',
    title: 'The Ember Road',
    isbn13: null,
    isbn10: null,
    coverUrl: null,
    volumeNumber: 3,
    author: { id: 'a1', name: 'Mira Voss' },
    series: null,
  },
}

describe('BookCard', () => {
  it('renders the title and author, and links to the detail page', () => {
    render(
      <MemoryRouter>
        <BookCard item={item} />
      </MemoryRouter>,
    )

    expect(screen.getAllByText('The Ember Road').length).toBeGreaterThan(0)
    expect(screen.getByText('Mira Voss')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/library/hb1')
  })
})
