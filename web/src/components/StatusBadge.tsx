import type { VolumeStatus } from '../lib/types'

const STYLES: Record<VolumeStatus, { label: string; bg: string; text: string }> = {
  owned: { label: 'Owned', bg: 'bg-success-soft', text: 'text-success' },
  wishlist: { label: 'Wishlist', bg: 'bg-accent-soft', text: 'text-accent' },
  hunting: { label: 'Hunting', bg: 'bg-warning-soft', text: 'text-warning' },
  missing: { label: 'Missing', bg: 'bg-danger-soft', text: 'text-danger' },
}

export function StatusBadge({ status }: { status: VolumeStatus }) {
  const style = STYLES[status]
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  )
}
