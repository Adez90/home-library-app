import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, api } from '../lib/api'
import type { Favorite, HouseholdBook } from '../lib/types'
import { HeartIcon, PlusIcon } from '../components/icons'
import { useTranslation } from '../lib/i18n'

export function WishlistPage() {
  const { t } = useTranslation()
  const [wanted, setWanted] = useState<HouseholdBook[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)

  const [targetType, setTargetType] = useState<'author' | 'series'>('author')
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get<HouseholdBook[]>('/household-books?status=wishlist'),
      api.get<HouseholdBook[]>('/household-books?status=hunting'),
      api.get<Favorite[]>('/favorites'),
    ])
      .then(([wishlist, hunting, favs]) => {
        setWanted([...wishlist, ...hunting])
        setFavorites(favs)
      })
      .finally(() => setLoading(false))
  }, [])

  async function addFavorite(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    setAdding(true)
    setAddError('')
    try {
      const favorite = await api.post<Favorite>('/favorites', { targetType, name: trimmed })
      setFavorites((prev) => [favorite, ...prev])
      setName('')
    } catch (err) {
      setAddError(err instanceof ApiError && err.status === 409 ? t('wishlist.alreadyFavorited') : t('common.somethingWentWrong'))
    } finally {
      setAdding(false)
    }
  }

  async function removeFavorite(id: string) {
    await api.delete(`/favorites/${id}`)
    setFavorites((prev) => prev.filter((f) => f.id !== id))
  }

  if (loading) return <p className="text-sm text-text-secondary">{t('common.loading')}</p>

  return (
    <div className="max-w-md flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-bold">{t('wishlist.title')}</h1>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-text-secondary">
          {t('wishlist.missingAndWanted')}
        </h2>
        {wanted.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('wishlist.empty')}</p>
        ) : (
          wanted.map((item) => (
            <Link
              key={item.id}
              to={`/library/${item.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
            >
              <div className="flex-1">
                <div className="text-sm font-semibold">{item.book.title}</div>
                {item.book.series && (
                  <div className="text-xs text-text-secondary">
                    {item.book.series.name}
                    {item.book.author ? ` · ${item.book.author.name}` : ''}
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-text-secondary">{t('wishlist.watchingFor')}</h2>
        {favorites.length === 0 ? (
          <p className="text-sm text-text-secondary">{t('wishlist.favoritesEmpty')}</p>
        ) : (
          favorites.map((fav) => {
            const to = fav.targetType === 'series' ? `/series/${fav.targetId}` : `/library?search=${encodeURIComponent(fav.name)}`
            const stats =
              fav.targetType === 'series' && fav.totalCount !== undefined
                ? t('series.owned', { owned: fav.ownedCount, total: fav.totalCount })
                : t('wishlist.ownedCount', { count: fav.ownedCount })

            return (
              <div key={fav.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
                <Link to={to} className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{fav.name}</div>
                  <div className="text-xs text-text-secondary">
                    <span>{t(fav.targetType === 'author' ? 'wishlist.favoriteAuthor' : 'wishlist.favoriteSeries')}</span>
                    {' · '}
                    <span>{stats}</span>
                  </div>
                </Link>
                <button type="button" onClick={() => removeFavorite(fav.id)} aria-label={t('wishlist.removeFavorite')}>
                  <HeartIcon width={16} height={16} filled className="text-accent" />
                </button>
              </div>
            )
          })
        )}

        <form onSubmit={addFavorite} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 mt-1">
          <span className="text-xs font-semibold text-text-secondary">{t('wishlist.addFavorite')}</span>
          <div className="flex gap-2">
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as 'author' | 'series')}
              aria-label={t('wishlist.addFavorite')}
              className="rounded-lg border border-border bg-transparent px-2 py-2 text-sm"
            >
              <option value="author">{t('wishlist.typeAuthor')}</option>
              <option value="series">{t('wishlist.typeSeries')}</option>
            </select>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('wishlist.namePlaceholder')}
              className="flex-1 min-w-0 rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={adding || !name.trim()}
              aria-label={t('wishlist.add')}
              className="rounded-lg bg-accent text-white px-3 py-2 disabled:opacity-60"
            >
              <PlusIcon width={16} height={16} />
            </button>
          </div>
          {addError && <p className="text-xs text-danger">{addError}</p>}
        </form>
      </section>
    </div>
  )
}
