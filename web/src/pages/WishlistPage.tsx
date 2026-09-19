import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Favorite, HouseholdBook } from '../lib/types'
import { HeartIcon } from '../components/icons'
import { useTranslation } from '../lib/i18n'

export function WishlistPage() {
  const { t } = useTranslation()
  const [wanted, setWanted] = useState<HouseholdBook[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)

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
          favorites.map((fav) => (
            <div key={fav.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
              <div className="flex-1">
                <div className="text-sm font-semibold">{fav.name}</div>
                <div className="text-xs text-text-secondary">
                  {t(fav.targetType === 'author' ? 'wishlist.favoriteAuthor' : 'wishlist.favoriteSeries')}
                </div>
              </div>
              <button type="button" onClick={() => removeFavorite(fav.id)} aria-label={t('wishlist.removeFavorite')}>
                <HeartIcon width={16} height={16} filled className="text-accent" />
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
