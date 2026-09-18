import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type { SeriesDetail } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'
import { ChevronLeftIcon, HeartIcon } from '../components/icons'

export function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [series, setSeries] = useState<SeriesDetail | null>(null)
  const [favoriting, setFavoriting] = useState(false)
  const [favorited, setFavorited] = useState(false)

  useEffect(() => {
    if (!id) return
    api.get<SeriesDetail>(`/series/${id}`).then(setSeries)
  }, [id])

  async function favoriteSeries() {
    if (!series) return
    setFavoriting(true)
    try {
      await api.post('/favorites', { targetType: 'series', targetId: series.id })
      setFavorited(true)
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 409)) throw err
      setFavorited(true)
    } finally {
      setFavoriting(false)
    }
  }

  if (!series) return <p className="text-sm text-text-secondary">Loading…</p>

  const pct = series.totalCount > 0 ? Math.round((series.ownedCount / series.totalCount) * 100) : 0

  return (
    <div className="max-w-md flex flex-col gap-5">
      <Link to="/series" className="inline-flex items-center gap-1 text-sm text-text-secondary">
        <ChevronLeftIcon width={16} height={16} />
        All series
      </Link>

      <div className="flex items-center gap-2">
        <h1 className="font-heading text-2xl font-bold">{series.name}</h1>
        <button type="button" onClick={favoriteSeries} disabled={favoriting || favorited} aria-label="Favorite series">
          <HeartIcon width={18} height={18} filled={favorited} className={favorited ? 'text-accent' : 'text-text-secondary'} />
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="font-semibold">
            {series.ownedCount} of {series.totalCount} owned
          </span>
          <span className="text-text-secondary">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-success" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {series.volumes.map((v) => (
          <div key={v.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
            <div className="flex-1 text-sm font-semibold">
              {v.volumeNumber != null ? `Book ${v.volumeNumber}: ` : ''}
              {v.title}
            </div>
            <StatusBadge status={v.status} />
          </div>
        ))}
      </div>
    </div>
  )
}
