import { NavLink, Outlet } from 'react-router-dom'
import type { ComponentType, SVGProps } from 'react'
import { LibraryIcon, ScanIcon, SeriesIcon, HeartIcon } from './icons'
import { useAuth } from '../lib/auth'

const NAV_ITEMS: { to: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { to: '/library', label: 'Library', icon: LibraryIcon },
  { to: '/add', label: 'Scan', icon: ScanIcon },
  { to: '/series', label: 'Series', icon: SeriesIcon },
  { to: '/wishlist', label: 'Wishlist', icon: HeartIcon },
]

function navLinkClasses(isActive: boolean) {
  return isActive ? 'text-accent' : 'text-text-secondary'
}

export function AppShell() {
  const { logout, households } = useAuth()
  const household = households[0]

  return (
    <div className="min-h-svh flex flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3 md:px-6">
          <span className="font-heading text-lg font-semibold">
            {household ? household.name : 'Home Library'}
          </span>

          <nav className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map(({ to, label, icon: ItemIcon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }: { isActive: boolean }) =>
                  `flex items-center gap-2 text-sm font-medium ${navLinkClasses(isActive)}`
                }
              >
                <ItemIcon width={18} height={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => logout()}
            className="text-sm font-medium text-text-secondary hover:text-text"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:px-6 md:pb-10">
        <Outlet />
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex items-center justify-around py-2">
        {NAV_ITEMS.map(({ to, label, icon: ItemIcon }) => (
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
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
