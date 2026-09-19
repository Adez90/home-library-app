import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type { SeriesDetail } from '../lib/types'
import { StatusBadge } from '../components/StatusBadge'
import { LanguageBadge } from '../components/LanguageBadge'
import { ChevronLeftIcon, HeartIcon } from '../components/icons'
import { useTranslation } from '../lib/i18n'

export function SeriesDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const [series, setSeries] = useState<SeriesDetail | null>(null)
  const [favoriting, setFavoriting] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [languageFilter, setLanguageFilter] = useState<string | 'all'>('all')
  const [editingCount, setEditingCount] = useState(false)
  const [countInput, setCountInput] = useState('')
  const [savingCount, setSavingCount] = useState(false)

  useEffect(() => {
    if (!id) return
    api.get<SeriesDetail>(`/series/${id}`).then(setSeries)
  }, [id])

  async function saveExpectedVolumeCount(value: number | null) {
    if (!series) return
    setSavingCount(true)
    try {
      const updated = await api.patch<SeriesDetail>(`/series/${series.id}`, { expectedVolumeCount: value })
      setSeries(updated)
      setEditingCount(false)
    } finally {
      setSavingCount(false)
    }
  }

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

  if (!series) return <p className="text-sm text-text-secondary">{t('common.loading')}</p>

  const visibleVolumes =
    languageFilter === 'all' ? series.volumes : series.volumes.filter((v) => v.language === languageFilter)

  const ownedCount =
    languageFilter === 'all' ? series.ownedCount : visibleVolumes.filter((v) => v.status === 'owned').length
  const totalCount = languageFilter === 'all' ? series.totalCount : visibleVolumes.length
  const pct = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0

  return (
    <div className="max-w-md flex flex-col gap-5">
      <Link to="/series" className="inline-flex items-center gap-1 text-sm text-text-secondary">
        <ChevronLeftIcon width={16} height={16} />
        {t('series.allSeries')}
      </Link>

      <div className="flex items-center gap-2">
        <h1 className="font-heading text-2xl font-bold">{series.name}</h1>
        <button
          type="button"
          onClick={favoriteSeries}
          disabled={favoriting || favorited}
          aria-label={t('wishlist.favoriteSeries')}
        >
          <HeartIcon width={18} height={18} filled={favorited} className={favorited ? 'text-accent' : 'text-text-secondary'} />
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="font-semibold">{t('series.owned', { owned: ownedCount, total: totalCount })}</span>
          <span className="text-text-secondary">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-border overflow-hidden">
          <div className="h-full bg-success" style={{ width: `${pct}%` }} />
        </div>

        {editingCount ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const trimmed = countInput.trim()
              saveExpectedVolumeCount(trimmed ? Number(trimmed) : null)
            }}
            className="flex items-center gap-2 mt-2"
          >
            <input
              type="number"
              min={1}
              autoFocus
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
              placeholder={t('series.totalVolumesPlaceholder')}
              className="w-24 rounded-lg border border-border px-2 py-1 text-xs"
            />
            <button type="submit" disabled={savingCount} className="text-xs text-accent font-medium">
              {t('common.save')}
            </button>
            <button type="button" onClick={() => setEditingCount(false)} className="text-xs text-text-secondary">
              {t('common.cancel')}
            </button>
            {series.expectedVolumeCount != null && (
              <button
                type="button"
                onClick={() => saveExpectedVolumeCount(null)}
                disabled={savingCount}
                className="text-xs text-text-secondary underline"
              >
                {t('series.clearTotal')}
              </button>
            )}
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setCountInput(series.expectedVolumeCount != null ? String(series.expectedVolumeCount) : '')
              setEditingCount(true)
            }}
            className="text-xs text-accent font-medium mt-2"
          >
            {series.expectedVolumeCount != null ? t('series.editTotal') : t('series.setTotal')}
          </button>
        )}
      </div>

      {series.languages.length > 1 && (
        <div className="flex gap-2">
          <button
            onClick={() => setLanguageFilter('all')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              languageFilter === 'all' ? 'bg-text text-white' : 'bg-surface border border-border text-text-secondary'
            }`}
          >
            {t('series.allLanguages')}
          </button>
          {series.languages.map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguageFilter(lang)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase ${
                languageFilter === lang ? 'bg-text text-white' : 'bg-surface border border-border text-text-secondary'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {visibleVolumes.map((v) => (
          <div key={v.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
            <div className="flex-1 text-sm font-semibold flex items-center gap-2">
              <span>
                {v.volumeNumber != null ? t('common.bookNumber', { n: v.volumeNumber }) : ''}
                {v.title ? `${v.volumeNumber != null ? ': ' : ''}${v.title}` : ''}
              </span>
              <LanguageBadge language={v.language} />
            </div>
            <StatusBadge status={v.status} />
          </div>
        ))}
      </div>
    </div>
  )
}
