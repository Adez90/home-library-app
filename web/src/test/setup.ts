import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// We don't run vitest with `globals: true`, so @testing-library/react's own auto-cleanup
// (which detects a global `afterEach`) never registers — without this, rendered trees from
// one test leak into the next within the same file.
afterEach(() => {
  cleanup()
})
