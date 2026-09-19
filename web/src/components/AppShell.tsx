import { NavLink, Outlet } from 'react-router-dom'
import type { ComponentType, SVGProps } from 'react'
import { LibraryIcon, ScanIcon, SeriesIcon, HeartIcon } from './icons'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useAuth } from '../lib/auth'
import { useTranslation } from '../lib/i18n'
import type { TranslationKey } from '../lib/i18n/translations'

const NAV_ITEMS: { to: string; labelKey: TranslationKey; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { to: '/library', labelKey: 'nav.library', icon: LibraryIcon },
  { to: '/add', labelKey: 'nav.scan', icon: ScanIcon },
  { to: '/series', labelKey: 'nav.series', icon: SeriesIcon },
  { to: '/wishlist', labelKey: 'nav.wishlist', icon: HeartIcon },
]

function navLinkClasses(isActive: boolean) {
  return isActive ? 'text-accent' : 'text-text-secondary'
}

export function AppShell() {
  const { logout, households } = useAuth()
  const { t } = useTranslation()
  const household = households[0]

  return (
    <div className="min-h-svh flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3 md:px-6 gap-3">
          <span className="font-heading text-lg font-semibold">
            {household ? household.name : t('nav.defaultHouseholdName')}
          </span>

          <nav className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map(({ to, labelKey, icon: ItemIcon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }: { isActive: boolean }) =>
                  `flex items-center gap-2 text-sm font-medium ${navLinkClasses(isActive)}`
                }
              >
                <ItemIcon width={18} height={18} />
                {t(labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => logout()}
              className="text-sm font-medium text-text-secondary hover:text-text"
            >
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:px-6 md:pb-10">
        <Outlet />
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex items-center justify-around py-2">
        {NAV_ITEMS.map(({ to, labelKey, icon: ItemIcon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }: { isActive: boolean }) =>
              `flex flex-col items-center gap-1 px-3 py-1 text-xs font-medium ${navLinkClasses(isActive)}`
            }
          >
            {({ isActive }: { isActive: boolean }) => (
              <>
                <span className={`flex items-center justify-center w-9 h-7 rounded-lg ${isActive ? 'bg-accent-soft' : ''}`}>
                  <ItemIcon width={18} height={18} />
                </span>
                {t(labelKey)}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
