export function FormatBadge({ format }: { format: string | null | undefined }) {
  if (!format) return null
  return (
    <span className="inline-flex items-center rounded-full bg-border px-2 py-0.5 text-[10px] font-bold tracking-wide text-text-secondary">
      {format}
    </span>
  )
}
