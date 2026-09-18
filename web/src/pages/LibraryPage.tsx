import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { BookStatus, HouseholdBook } from '../lib/types'
import { BookCard } from '../components/BookCard'
import { SearchIcon, PlusIcon } from '../components/icons'

const FILTERS: { value: BookStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'owned', label: 'Owned' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'hunting', label: 'Hunting' },
]

export function LibraryPage() {
  const [books, setBooks] = useState<HouseholdBook[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<BookStatus | 'all'>('all')

  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filter !== 'all') params.set('status', filter)
    const query = params.toString()

    setLoading(true)
    api
      .get<HouseholdBook[]>(`/household-books${query ? `?${query}` : ''}`)
      .then(setBooks)
      .finally(() => setLoading(false))
  }, [search, filter])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">Your library</h1>
        <Link
          to="/add"
          className="hidden md:inline-flex items-center gap-2 rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2"
        >
          <PlusIcon width={16} height={16} />
          Add book
        </Link>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
        <SearchIcon width={16} height={16} className="text-text-secondary" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your books…"
          className="w-full text-sm outline-none bg-transparent"
        />
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              filter === f.value ? 'bg-text text-white' : 'bg-surface border border-border text-text-secondary'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : books.length === 0 ? (
        <p className="text-sm text-text-secondary">
          Nothing here yet.{' '}
          <Link to="/add" className="text-accent font-medium">
            Add your first book
          </Link>
          .
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {books.map((item) => (
            <BookCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <Link
        to="/add"
        className="md:hidden fixed bottom-24 right-5 w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center shadow-lg"
        aria-label="Add book"
      >
        <PlusIcon width={24} height={24} />
      </Link>
    </div>
  )
}
