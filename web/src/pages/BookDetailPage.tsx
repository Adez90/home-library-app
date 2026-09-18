import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type { BookStatus, HouseholdBook } from '../lib/types'
import { ChevronLeftIcon, HeartIcon } from '../components/icons'
import { LanguageBadge } from '../components/LanguageBadge'

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: 'owned', label: 'Owned' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'hunting', label: 'Hunting' },
]

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [item, setItem] = useState<HouseholdBook | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [favoriting, setFavoriting] = useState(false)
  const [favorited, setFavorited] = useState(false)

  useEffect(() => {
    if (!id) return
    api.get<HouseholdBook>(`/household-books/${id}`).then((data) => {
      setItem(data)
      setNote(data.conditionNote ?? '')
    })
  }, [id])

  async function updateStatus(status: BookStatus) {
    if (!item) return
    setSaving(true)
    try {
      const updated = await api.patch<HouseholdBook>(`/household-books/${item.id}`, { status })
      setItem(updated)
    } finally {
      setSaving(false)
    }
  }

  async function saveNote() {
    if (!item) return
    setSaving(true)
    try {
      const updated = await api.patch<HouseholdBook>(`/household-books/${item.id}`, { conditionNote: note })
      setItem(updated)
    } finally {
      setSaving(false)
    }
  }

  async function favoriteAuthor() {
    if (!item?.book.author) return
    setFavoriting(true)
    try {
      await api.post('/favorites', { targetType: 'author', targetId: item.book.author.id })
      setFavorited(true)
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 409)) throw err
      setFavorited(true)
    } finally {
      setFavoriting(false)
    }
  }

  async function removeBook() {
    if (!item) return
    if (!window.confirm('Remove this book from your library?')) return
    await api.delete(`/household-books/${item.id}`)
    navigate('/library')
  }

  if (!item) return <p className="text-sm text-text-secondary">Loading…</p>

  const { book } = item

  return (
    <div className="max-w-md flex flex-col gap-5">
      <Link to="/library" className="inline-flex items-center gap-1 text-sm text-text-secondary">
        <ChevronLeftIcon width={16} height={16} />
        Back to library
      </Link>

      <div className="flex justify-center">
        <div
          className="w-42 h-60 rounded-xl flex items-end p-4 bg-cover bg-center shadow-lg"
          style={{ backgroundColor: '#3F6B5C', backgroundImage: book.coverUrl ? `url(${book.coverUrl})` : undefined }}
        >
          {!book.coverUrl && <span className="font-heading text-white font-bold">{book.title}</span>}
        </div>
      </div>

      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <h1 className="font-heading text-xl font-bold">{book.title}</h1>
          <LanguageBadge language={book.language} />
        </div>
        {book.author && (
          <div className="flex items-center justify-center gap-2 text-sm text-text-secondary mt-1">
            {book.author.name}
            <button type="button" onClick={favoriteAuthor} disabled={favoriting || favorited} aria-label="Favorite author">
              <HeartIcon width={14} height={14} filled={favorited} className={favorited ? 'text-accent' : ''} />
            </button>
          </div>
        )}
        {book.series && (
          <Link
            to={`/series/${book.series.id}`}
            className="inline-block mt-2 rounded-full border border-border px-3 py-1 text-xs font-semibold"
          >
            {book.series.name}
            {book.volumeNumber != null ? ` · Book ${book.volumeNumber}` : ''}
          </Link>
        )}
      </div>

      <div className="flex justify-center gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => updateStatus(opt.value)}
            disabled={saving}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              item.status === opt.value ? 'bg-text text-white' : 'bg-surface border border-border text-text-secondary'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <label htmlFor="condition-note" className="text-xs font-bold uppercase tracking-wide text-text-secondary">
          Condition &amp; notes
        </label>
        <textarea
          id="condition-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          rows={3}
          className="mt-2 w-full text-sm outline-none resize-none"
          placeholder="Add a note…"
        />
      </div>

      {book.isbn13 && <p className="text-xs text-text-secondary text-center">ISBN {book.isbn13}</p>}

      <button type="button" onClick={removeBook} className="text-sm text-danger font-medium self-center">
        Remove from library
      </button>
    </div>
  )
}
