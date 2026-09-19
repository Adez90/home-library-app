import type { VolumeStatus } from '../lib/types'
import { useTranslation } from '../lib/i18n'
import type { TranslationKey } from '../lib/i18n/translations'

const STYLES: Record<VolumeStatus, { labelKey: TranslationKey; bg: string; text: string }> = {
  owned: { labelKey: 'bookDetail.statusOwned', bg: 'bg-success-soft', text: 'text-success' },
  wishlist: { labelKey: 'bookDetail.statusWishlist', bg: 'bg-accent-soft', text: 'text-accent' },
  hunting: { labelKey: 'bookDetail.statusHunting', bg: 'bg-warning-soft', text: 'text-warning' },
  missing: { labelKey: 'bookDetail.statusMissing', bg: 'bg-danger-soft', text: 'text-danger' },
}

export function StatusBadge({ status }: { status: VolumeStatus }) {
  const { t } = useTranslation()
  const style = STYLES[status]
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${style.bg} ${style.text}`}>
      {t(style.labelKey)}
    </span>
  )
}
