import { useEffect, useRef, useState } from 'react'
import type { Household } from '../lib/types'
import { useTranslation } from '../lib/i18n'

export function HouseholdMenu({ household }: { household: Household }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(household.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard access can fail (permissions, insecure context) — the code is still shown, just not auto-copied
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="font-heading text-lg font-semibold"
        aria-expanded={open}
      >
        {household.name}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-border bg-surface p-4 shadow-lg z-10 text-left">
          <p className="text-xs font-bold uppercase tracking-wide text-text-secondary">{t('nav.inviteCode')}</p>
          <p className="text-xs text-text-secondary mt-1">{t('nav.inviteHint')}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-bg px-2.5 py-1.5 text-sm font-mono tracking-wide">
              {household.inviteCode}
            </code>
            <button
              type="button"
              onClick={copyCode}
              className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold shrink-0"
            >
              {copied ? t('nav.copied') : t('nav.copyCode')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
