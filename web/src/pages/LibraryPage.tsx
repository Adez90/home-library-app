import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { BookStatus, HouseholdBook } from '../lib/types'
import { BookCard } from '../components/BookCard'
import { SearchIcon, PlusIcon } from '../components/icons'
import { useTranslation } from '../lib/i18n'
import type { TranslationKey } from '../lib/i18n/translations'

const FILTERS: { value: BookStatus | 'all'; labelKey: TranslationKey }[] = [
  { value: 'all', labelKey: 'library.filterAll' },
  { value: 'owned', labelKey: 'library.filterOwned' },
  { value: 'wishlist', labelKey: 'library.filterWishlist' },
  { value: 'hunting', labelKey: 'library.filterHunting' },
]

export function LibraryPage() {
  const { t } = useTranslation()
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
        <h1 className="font-heading text-2xl font-bold">{t('library.title')}</h1>
        <Link
          to="/add"
          className="hidden md:inline-flex items-center gap-2 rounded-lg bg-accent text-white text-sm font-semibold px-4 py-2"
        >
          <PlusIcon width={16} height={16} />
          {t('library.addBook')}
        </Link>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5">
        <SearchIcon width={16} height={16} className="text-text-secondary" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('library.search')}
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
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">{t('common.loading')}</p>
      ) : books.length === 0 ? (
        <p className="text-sm text-text-secondary">
          {t('library.empty')}{' '}
          <Link to="/add" className="text-accent font-medium">
            {t('library.addFirstBook')}
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
        aria-label={t('library.addBook')}
      >
        <PlusIcon width={24} height={24} />
      </Link>
    </div>
  )
}
