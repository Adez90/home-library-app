import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarcodeDetector } from 'barcode-detector/pure'
import { api, ApiError } from '../lib/api'
import type { HouseholdBook } from '../lib/types'
import { ScanIcon } from '../components/icons'
import { useTranslation } from '../lib/i18n'

export function AddBookPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [isbn, setIsbn] = useState('')
  const [title, setTitle] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [seriesName, setSeriesName] = useState('')
  const [volumeNumber, setVolumeNumber] = useState('')
  const [language, setLanguage] = useState('')
  const [showSeriesFields, setShowSeriesFields] = useState(false)
  const [needsManualEntry, setNeedsManualEntry] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // The camera itself (getUserMedia) is the real requirement — barcode decoding runs via the
  // barcode-detector ponyfill (zxing-wasm), which works the same in every modern browser
  // including Safari/iOS, so there's no browser-specific feature to check for that anymore.
  const scanSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  // Attaching the stream and starting detection has to happen in an effect keyed on `scanning`,
  // not inline in startScan: the <video> element only exists once React has re-rendered with
  // scanning=true, so reading videoRef.current synchronously right after setScanning(true) (the
  // previous approach) always found it null — the stream was captured but never shown, a
  // permanently black preview.
  useEffect(() => {
    if (!scanning || !streamRef.current || !videoRef.current) return
    const video = videoRef.current
    video.srcObject = streamRef.current
    video.play().catch(() => {})

    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })
    let cancelled = false

    const tick = async () => {
      if (cancelled || !streamRef.current) return
      try {
        const codes = await detector.detect(video)
        if (codes.length > 0) {
          setIsbn(codes[0].rawValue)
          stopScan()
          return
        }
      } catch {
        // keep trying on transient detector errors
      }
      if (!cancelled) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)

    return () => {
      cancelled = true
    }
  }, [scanning])

  async function startScan() {
    setScanError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setScanning(true)
    } catch {
      setScanError(t('addBook.cameraError'))
      setScanning(false)
    }
  }

  function stopScan() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setScanning(false)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const payload: Record<string, string> = {}
      if (isbn) payload.isbn = isbn.trim()
      if (title) payload.title = title.trim()
      if (authorName) payload.authorName = authorName.trim()
      if (seriesName) payload.seriesName = seriesName.trim()
      if (volumeNumber) payload.volumeNumber = volumeNumber.trim()
      if (language) payload.language = language.trim()

      const added = await api.post<HouseholdBook>('/household-books', payload)
      navigate(`/library/${added.id}`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && isbn && !title) {
        setNeedsManualEntry(true)
        setError(t('addBook.notFound'))
      } else if (err instanceof ApiError && err.status === 409) {
        setError(t('addBook.alreadyInLibrary'))
      } else {
        setError(err instanceof ApiError ? err.message : t('common.somethingWentWrong'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <h1 className="font-heading text-2xl font-bold">{t('addBook.title')}</h1>

      <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
        {scanning ? (
          <div className="flex flex-col gap-3">
            <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video" muted playsInline />
            <button
              type="button"
              onClick={stopScan}
              className="rounded-lg border border-border text-sm font-semibold py-2"
            >
              {t('addBook.cancelScan')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startScan}
            disabled={!scanSupported}
            className="flex items-center justify-center gap-2 rounded-lg bg-text text-white text-sm font-semibold py-3 disabled:opacity-40"
          >
            <ScanIcon width={18} height={18} />
            {t('addBook.scanBarcode')}
          </button>
        )}
        {!scanSupported && <p className="text-xs text-text-secondary">{t('addBook.scanUnsupported')}</p>}
        {scanError && <p className="text-xs text-danger">{scanError}</p>}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          {t('addBook.isbn')}
          <input
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            placeholder={t('addBook.isbnPlaceholder')}
            className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
          />
        </label>

        {(needsManualEntry || !isbn) && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('addBook.titleLabel')}{' '}
              {!isbn && <span className="text-text-secondary font-normal">{t('addBook.titleHint')}</span>}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('addBook.author')} <span className="text-text-secondary font-normal">{t('common.optional')}</span>
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              {t('addBook.language')} <span className="text-text-secondary font-normal">{t('addBook.languageHint')}</span>
              <input
                list="language-options"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder={t('addBook.languagePlaceholder')}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
              />
              <datalist id="language-options">
                <option value="en">{t('addBook.languageEnglish')}</option>
                <option value="sv">{t('addBook.languageSwedish')}</option>
              </datalist>
            </label>
          </>
        )}

        {showSeriesFields ? (
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              {t('addBook.series')} <span className="text-text-secondary font-normal">{t('common.optional')}</span>
              <input
                value={seriesName}
                onChange={(e) => setSeriesName(e.target.value)}
                placeholder={t('addBook.seriesPlaceholder')}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium w-20">
              {t('addBook.bookNumber')}
              <input
                type="number"
                min={1}
                value={volumeNumber}
                onChange={(e) => setVolumeNumber(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
              />
            </label>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSeriesFields(true)}
            className="text-sm text-accent font-medium self-start"
          >
            {t('addBook.addSeriesInfo')}
          </button>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting || (!isbn && !title)}
          className="rounded-lg bg-accent text-white font-semibold py-2.5 text-sm disabled:opacity-50"
        >
          {submitting ? t('addBook.submitting') : t('addBook.submit')}
        </button>
      </form>
    </div>
  )
}
