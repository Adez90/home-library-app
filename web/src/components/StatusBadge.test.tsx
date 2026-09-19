import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'
import { I18nProvider } from '../lib/i18n'
import type { VolumeStatus } from '../lib/types'

describe('StatusBadge', () => {
  it.each([
    ['owned', 'Owned'],
    ['wishlist', 'Wishlist'],
    ['hunting', 'Hunting'],
    ['missing', 'Missing'],
  ] as [VolumeStatus, string][])('renders %s as %s (English, the test environment default)', (status, label) => {
    render(
      <I18nProvider>
        <StatusBadge status={status} />
      </I18nProvider>,
    )
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
