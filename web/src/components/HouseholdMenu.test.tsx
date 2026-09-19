import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HouseholdMenu } from './HouseholdMenu'
import { I18nProvider } from '../lib/i18n'
import type { Household } from '../lib/types'

const household: Household = { id: 'h1', name: "Ander's library", role: 'owner', inviteCode: 'ABC123' }

describe('HouseholdMenu', () => {
  it('reveals the invite code on click and hides it again on an outside click', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <div>
          <HouseholdMenu household={household} />
          <button type="button">outside</button>
        </div>
      </I18nProvider>,
    )

    expect(screen.queryByText('ABC123')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: "Ander's library" }))
    expect(screen.getByText('ABC123')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByText('ABC123')).not.toBeInTheDocument()
  })

  it('copies the invite code to the clipboard', async () => {
    // user-event configures its own real (in-memory) Clipboard stub on setup() — replacing
    // navigator.clipboard ourselves would just get overridden by it, so we read the stub's
    // own state back afterward instead of mocking writeText directly.
    const user = userEvent.setup()

    render(
      <I18nProvider>
        <HouseholdMenu household={household} />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: "Ander's library" }))
    await user.click(screen.getByRole('button', { name: 'Copy' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument()
    })
    await expect(navigator.clipboard.readText()).resolves.toBe('ABC123')
  })
})
