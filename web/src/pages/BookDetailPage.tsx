import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type { BookStatus, HouseholdBook } from '../lib/types'
import { ChevronLeftIcon, HeartIcon } from '../components/icons'
import { LanguageBadge } from '../components/LanguageBadge'
import { useTranslation } from '../lib/i18n'
import type { TranslationKey } from '../lib/i18n/translations'

const STATUS_OPTIONS: { value: BookStatus; labelKey: TranslationKey }[] = [
  { value: 'owned', labelKey: 'bookDetail.statusOwned' },
  { value: 'wishlist', labelKey: 'bookDetail.statusWishlist' },
  { value: 'hunting', labelKey: 'bookDetail.statusHunting' },
]

export function BookDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [item, setItem] = useState<HouseholdBook | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [favoriting, setFavoriting] = useState(false)
  const [favorited, setFavorited] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editSeries, setEditSeries] = useState('')
  const [editVolume, setEditVolume] = useState('')
  const [editLanguage, setEditLanguage] = useState('')
  const [editCoverUrl, setEditCoverUrl] = useState('')
  const [savingDetails, setSavingDetails] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.get<HouseholdBook>(`/household-books/${id}`).then((data) => {
      setItem(data)
      setNote(data.conditionNote ?? '')
    })
  }, [id])

  function startEditing() {
    if (!item) return
    setEditTitle(item.book.title)
    setEditAuthor(item.book.author?.name ?? '')
    setEditSeries(item.book.series?.name ?? '')
    setEditVolume(item.book.volumeNumber != null ? String(item.book.volumeNumber) : '')
    setEditLanguage(item.book.language ?? '')
    setEditCoverUrl(item.book.coverUrl ?? '')
    setEditError(null)
    setEditing(true)
  }

  async function saveDetails(e: FormEvent) {
    e.preventDefault()
    if (!item) return
    const trimmedTitle = editTitle.trim()
    if (!trimmedTitle) return

    const trimmedSeries = editSeries.trim()
    const payload: Record<string, string | number | null> = {
      title: trimmedTitle,
      authorName: editAuthor.trim(),
      seriesName: trimmedSeries,
      language: editLanguage.trim(),
      coverUrl: editCoverUrl.trim(),
    }
    if (trimmedSeries) {
      if (editVolume.trim()) payload.volumeNumber = Number(editVolume)
    } else {
      payload.volumeNumber = null
    }

    setSavingDetails(true)
    setEditError(null)
    try {
      const updatedBook = await api.patch<HouseholdBook['book']>(`/books/${item.book.id}`, payload)
      setItem({ ...item, book: updatedBook })
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : t('common.somethingWentWrong'))
    } finally {
      setSavingDetails(false)
    }
  }

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
    if (!window.confirm(t('bookDetail.removeConfirm'))) return
    await api.delete(`/household-books/${item.id}`)
    navigate('/library')
  }

  if (!item) return <p className="text-sm text-text-secondary">{t('common.loading')}</p>

  const { book } = item

  return (
    <div className="max-w-md flex flex-col gap-5">
      <Link to="/library" className="inline-flex items-center gap-1 text-sm text-text-secondary">
        <ChevronLeftIcon width={16} height={16} />
        {t('bookDetail.backToLibrary')}
      </Link>

      <div className="flex justify-center">
        <div
          className="w-42 h-60 rounded-xl flex items-end p-4 bg-cover bg-center shadow-lg"
          style={{ backgroundColor: '#3F6B5C', backgroundImage: book.coverUrl ? `url(${book.coverUrl})` : undefined }}
        >
          {!book.coverUrl && <span className="font-heading text-white font-bold">{book.title}</span>}
        </div>
      </div>

      {editing ? (
        <form onSubmit={saveDetails} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-xs text-text-secondary">{t('bookDetail.editHint')}</p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('addBook.titleLabel')}
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('addBook.author')} <span className="text-text-secondary font-normal">{t('common.optional')}</span>
            <input
              value={editAuthor}
              onChange={(e) => setEditAuthor(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              {t('addBook.series')} <span className="text-text-secondary font-normal">{t('common.optional')}</span>
              <input
                value={editSeries}
                onChange={(e) => setEditSeries(e.target.value)}
                placeholder={t('addBook.seriesPlaceholder')}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium w-20">
              {t('addBook.bookNumber')}{' '}
              {editSeries.trim() && <span className="text-danger font-normal">{t('common.required')}</span>}
              <input
                type="number"
                min={1}
                required={!!editSeries.trim()}
                value={editVolume}
                onChange={(e) => setEditVolume(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('addBook.language')} <span className="text-text-secondary font-normal">{t('common.optional')}</span>
            <input
              list="edit-language-options"
              value={editLanguage}
              onChange={(e) => setEditLanguage(e.target.value)}
              placeholder={t('addBook.languagePlaceholder')}
              className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
            />
            <datalist id="edit-language-options">
              <option value="en">{t('addBook.languageEnglish')}</option>
              <option value="sv">{t('addBook.languageSwedish')}</option>
            </datalist>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t('bookDetail.coverUrl')} <span className="text-text-secondary font-normal">{t('common.optional')}</span>
            <input
              value={editCoverUrl}
              onChange={(e) => setEditCoverUrl(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
            />
          </label>

          {editError && <p className="text-sm text-danger">{editError}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 rounded-lg border border-border text-sm font-semibold py-2"
            >
              {t('library.cancel')}
            </button>
            <button
              type="submit"
              disabled={savingDetails || !editTitle.trim() || (!!editSeries.trim() && !editVolume.trim())}
              className="flex-1 rounded-lg bg-accent text-white text-sm font-semibold py-2 disabled:opacity-50"
            >
              {savingDetails ? t('bookDetail.savingDetails') : t('bookDetail.saveDetails')}
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <h1 className="font-heading text-xl font-bold">{book.title}</h1>
            <LanguageBadge language={book.language} />
          </div>
          {book.author && (
            <div className="flex items-center justify-center gap-2 text-sm text-text-secondary mt-1">
              {book.author.name}
              <button
                type="button"
                onClick={favoriteAuthor}
                disabled={favoriting || favorited}
                aria-label={t('wishlist.favoriteAuthor')}
              >
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
              {book.volumeNumber != null ? ` · ${t('common.bookNumber', { n: book.volumeNumber })}` : ''}
            </Link>
          )}
          <button type="button" onClick={startEditing} className="block mx-auto mt-2 text-xs text-accent font-medium">
            {t('bookDetail.editDetails')}
          </button>
        </div>
      )}

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
            {t(opt.labelKey)}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <label htmlFor="condition-note" className="text-xs font-bold uppercase tracking-wide text-text-secondary">
          {t('bookDetail.conditionNotes')}
        </label>
        <textarea
          id="condition-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
          rows={3}
          className="mt-2 w-full text-sm outline-none resize-none"
          placeholder={t('bookDetail.addNote')}
        />
      </div>

      {book.isbn13 && (
        <p className="text-xs text-text-secondary text-center">{t('bookDetail.isbn', { isbn: book.isbn13 })}</p>
      )}

      <button type="button" onClick={removeBook} className="text-sm text-danger font-medium self-center">
        {t('bookDetail.remove')}
      </button>
    </div>
  )
}
