import { describe, expect, it, vi } from 'vitest';
import { lookupByIsbn, type FetchLike } from '../src/lib/metadata.js';

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    json: async () => body,
  } as Response;
}

describe('lookupByIsbn', () => {
  it('resolves title, author and series from Open Library', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('openlibrary.org/isbn/')) {
        return jsonResponse({
          title: 'The Ember Road',
          authors: [{ key: '/authors/OL123A' }],
          covers: [456],
          isbn_13: ['9789100123456'],
          series: ['The Lantern Cycle #3'],
        });
      }
      if (url.includes('/authors/OL123A.json')) {
        return jsonResponse({ name: 'Mira Voss' });
      }
      throw new Error(`unexpected url ${url}`);
    }) as unknown as FetchLike;

    const result = await lookupByIsbn('978-91-00-12345-6', fetchImpl);

    expect(result).toEqual({
      title: 'The Ember Road',
      authorName: 'Mira Voss',
      seriesName: 'The Lantern Cycle',
      volumeNumber: 3,
      isbn13: '9789100123456',
      isbn10: undefined,
      coverUrl: 'https://covers.openlibrary.org/b/id/456-L.jpg',
      source: 'open-library',
    });
  });

  it('falls back to Google Books when Open Library has nothing', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('openlibrary.org')) {
        return jsonResponse({}, false);
      }
      if (url.includes('googleapis.com/books')) {
        return jsonResponse({
          items: [{ volumeInfo: { title: 'Coastal Noir', authors: ['J. Alderman'], imageLinks: { thumbnail: 'http://example.com/cover.jpg' } } }],
        });
      }
      throw new Error(`unexpected url ${url}`);
    }) as unknown as FetchLike;

    const result = await lookupByIsbn('9780000000002', fetchImpl);

    expect(result).toEqual({
      title: 'Coastal Noir',
      authorName: 'J. Alderman',
      coverUrl: 'http://example.com/cover.jpg',
      isbn13: '9780000000002',
      isbn10: undefined,
      source: 'google-books',
    });
  });

  it('returns null when no provider has the book', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false)) as unknown as FetchLike;

    const result = await lookupByIsbn('0000000000000', fetchImpl);

    expect(result).toBeNull();
  });
});
