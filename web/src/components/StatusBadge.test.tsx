import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusBadge } from './StatusBadge'
import type { VolumeStatus } from '../lib/types'

describe('StatusBadge', () => {
  it.each([
    ['owned', 'Owned'],
    ['wishlist', 'Wishlist'],
    ['hunting', 'Hunting'],
    ['missing', 'Missing'],
  ] as [VolumeStatus, string][])('renders %s as %s', (status, label) => {
    render(<StatusBadge status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })
})
