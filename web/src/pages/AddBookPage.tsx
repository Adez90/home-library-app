import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import type { HouseholdBook } from '../lib/types'
import { ScanIcon } from '../components/icons'

// Not every browser exposes this yet — feature-detected, never assumed.
type BarcodeDetectorCtor = new (options: { formats: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
}

export function AddBookPage() {
  const navigate = useNavigate()
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

  const scanSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function startScan() {
    setScanError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setScanning(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector
      const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] })

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) {
            setIsbn(codes[0].rawValue)
            stopScan()
            return
          }
        } catch {
          // keep trying on transient detector errors
        }
        if (streamRef.current) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    } catch {
      setScanError('Could not access the camera. You can still enter the ISBN below.')
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
        setError('No match found for that ISBN — enter the title below and we will save it manually.')
      } else if (err instanceof ApiError && err.status === 409) {
        setError('This book is already in your library.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-md">
      <h1 className="font-heading text-2xl font-bold">Add a book</h1>

      <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
        {scanning ? (
          <div className="flex flex-col gap-3">
            <video ref={videoRef} className="w-full rounded-lg bg-black aspect-video" muted playsInline />
            <button
              type="button"
              onClick={stopScan}
              className="rounded-lg border border-border text-sm font-semibold py-2"
            >
              Cancel scan
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
            Scan barcode
          </button>
        )}
        {!scanSupported && (
          <p className="text-xs text-text-secondary">
            Camera barcode scanning isn't supported in this browser yet — enter the ISBN below instead.
          </p>
        )}
        {scanError && <p className="text-xs text-danger">{scanError}</p>}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          ISBN
          <input
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            placeholder="e.g. 9780747532699"
            className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
          />
        </label>

        {(needsManualEntry || !isbn) && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Title {!isbn && <span className="text-text-secondary font-normal">(if you don't have the ISBN)</span>}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Author <span className="text-text-secondary font-normal">(optional)</span>
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Language{' '}
              <span className="text-text-secondary font-normal">
                (optional — set this if you own the same book in more than one language)
              </span>
              <input
                list="language-options"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="e.g. en, sv"
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
              />
              <datalist id="language-options">
                <option value="en">English</option>
                <option value="sv">Swedish</option>
                <option value="da">Danish</option>
                <option value="no">Norwegian</option>
                <option value="de">German</option>
                <option value="fr">French</option>
              </datalist>
            </label>
          </>
        )}

        {showSeriesFields ? (
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium flex-1">
              Series <span className="text-text-secondary font-normal">(optional)</span>
              <input
                value={seriesName}
                onChange={(e) => setSeriesName(e.target.value)}
                placeholder="e.g. The Lantern Cycle"
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-2 focus:outline-accent"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium w-20">
              Book #
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
            + Add series info
          </button>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting || (!isbn && !title)}
          className="rounded-lg bg-accent text-white font-semibold py-2.5 text-sm disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add to library'}
        </button>
      </form>
    </div>
  )
}
