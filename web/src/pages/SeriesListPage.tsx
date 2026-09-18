import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { SeriesDetail } from '../lib/types'

export function SeriesListPage() {
  const [series, setSeries] = useState<SeriesDetail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<SeriesDetail[]>('/series')
      .then(setSeries)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-2xl font-bold">Series</h1>

      {loading ? (
        <p className="text-sm text-text-secondary">Loading…</p>
      ) : series.length === 0 ? (
        <p className="text-sm text-text-secondary">
          No series yet — books you add that belong to a series will show up here.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {series.map((s) => {
            const pct = s.totalCount > 0 ? Math.round((s.ownedCount / s.totalCount) * 100) : 0
            return (
              <Link key={s.id} to={`/series/${s.id}`} className="rounded-xl border border-border bg-surface p-4">
                <div className="font-semibold text-sm mb-2">{s.name}</div>
                <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                  <span>
                    {s.ownedCount} of {s.totalCount} owned
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 rounded-full bg-border overflow-hidden">
                  <div className="h-full bg-success" style={{ width: `${pct}%` }} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
