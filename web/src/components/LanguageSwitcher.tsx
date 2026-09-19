import { useTranslation } from '../lib/i18n'
import type { Lang } from '../lib/i18n/translations'

const OPTIONS: { value: Lang; label: string }[] = [
  { value: 'en', label: 'EN' },
  { value: 'sv', label: 'SV' },
]

export function LanguageSwitcher() {
  const { lang, setLang } = useTranslation()

  return (
    <div className="inline-flex rounded-full border border-border overflow-hidden text-xs font-semibold">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setLang(opt.value)}
          aria-pressed={lang === opt.value}
          className={`px-2.5 py-1 ${lang === opt.value ? 'bg-text text-white' : 'bg-surface text-text-secondary'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
