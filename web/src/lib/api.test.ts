import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './api'

// Regression test: Fastify's default JSON body parser rejects a request that declares
// Content-Type: application/json but sends no body (a real bug this caught end-to-end —
// logout, delete-from-library and remove-favorite were all silently failing because of it).
describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function mockFetch() {
    const fetchMock = vi.fn<typeof fetch>(async () => ({ ok: true, status: 204, json: async () => ({}) }) as Response)
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('does not set Content-Type on a bodyless POST (e.g. logout)', async () => {
    const fetchMock = mockFetch()
    await api.post('/auth/logout')

    const [, options] = fetchMock.mock.calls[0]
    const headers = options?.headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('does not set Content-Type on a DELETE request', async () => {
    const fetchMock = mockFetch()
    await api.delete('/favorites/abc')

    const [, options] = fetchMock.mock.calls[0]
    const headers = options?.headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('does set Content-Type when a POST has a real body', async () => {
    const fetchMock = mockFetch()
    await api.post('/auth/login', { email: 'a@example.com', password: 'x' })

    const [, options] = fetchMock.mock.calls[0]
    const headers = options?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })
})
