export function LanguageBadge({ language }: { language: string | null | undefined }) {
  if (!language) return null
  return (
    <span className="inline-flex items-center rounded-full bg-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
      {language}
    </span>
  )
}
