import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/metadata.js', () => ({ lookupByIsbn: vi.fn() }));

import { lookupByIsbn } from '../src/lib/metadata.js';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';

async function registerUser(app: ReturnType<typeof buildApp>, email: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password: 'password123', name: 'Test' },
  });
  const cookie = res.cookies.find((c) => c.name === 'session')!.value;
  return { cookie, body: res.json() };
}

describe('household books', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterEach(async () => {
    await prisma.householdBook.deleteMany();
    await prisma.favorite.deleteMany();
    await prisma.book.deleteMany();
    await prisma.author.deleteMany();
    await prisma.series.deleteMany();
    await prisma.householdMember.deleteMany();
    await prisma.household.deleteMany();
    await prisma.user.deleteMany();
    vi.mocked(lookupByIsbn).mockReset();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('adds a book by isbn using metadata lookup', async () => {
    vi.mocked(lookupByIsbn).mockResolvedValueOnce({
      title: 'The Ember Road',
      authorName: 'Mira Voss',
      seriesName: 'The Lantern Cycle',
      volumeNumber: 3,
      isbn13: '9789100123456',
      coverUrl: 'http://example.com/cover.jpg',
      source: 'open-library',
    });
    const { cookie } = await registerUser(app, 'a@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '9789100123456' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.book.title).toBe('The Ember Road');
    expect(body.book.author.name).toBe('Mira Voss');
    expect(body.book.series.name).toBe('The Lantern Cycle');
    expect(body.status).toBe('owned');
  });

  it('404s when isbn lookup finds nothing and no manual title is given', async () => {
    vi.mocked(lookupByIsbn).mockResolvedValueOnce(null);
    const { cookie } = await registerUser(app, 'b@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '0000000000000' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('accepts a manual title when isbn lookup fails', async () => {
    vi.mocked(lookupByIsbn).mockResolvedValueOnce(null);
    const { cookie } = await registerUser(app, 'c@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '0000000000001', title: 'My Own Copy', authorName: 'Someone' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().book.title).toBe('My Own Copy');
  });

  it('adds a book with just a title, no isbn, without calling metadata lookup', async () => {
    const { cookie } = await registerUser(app, 'd@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { title: 'Notebook', status: 'wishlist' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().status).toBe('wishlist');
    expect(lookupByIsbn).not.toHaveBeenCalled();
  });

  it('accepts a manual series name and volume number', async () => {
    const { cookie } = await registerUser(app, 'g@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { title: 'Book Four', seriesName: 'The Lantern Cycle', volumeNumber: 4 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.book.series.name).toBe('The Lantern Cycle');
    expect(body.book.volumeNumber).toBe(4);
  });

  it('rejects a manual series name with no volume number', async () => {
    const { cookie } = await registerUser(app, 'noseriesvolume@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { title: 'Philosopher’s Stone', seriesName: 'Harry Potter' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('reuses the same catalog row when two different households manually add the identical book', async () => {
    const alice = await registerUser(app, 'alice@example.com');
    const bob = await registerUser(app, 'bob@example.com');
    const payload = {
      title: 'Book Five: Winters Door',
      authorName: 'Mira Voss',
      seriesName: 'The Lantern Cycle',
      volumeNumber: 5,
      language: 'en',
    };

    const aliceAdd = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: alice.cookie },
      payload,
    });
    const bobAdd = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: bob.cookie },
      payload,
    });

    expect(aliceAdd.statusCode).toBe(201);
    expect(bobAdd.statusCode).toBe(201);
    expect(bobAdd.json().book.id).toBe(aliceAdd.json().book.id);
  });

  it('does not merge the same manual title across different languages', async () => {
    const { cookie } = await registerUser(app, 'bilingual@example.com');
    const base = { title: 'Throne of Glass', authorName: 'Sarah J. Maas' };

    const english = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { ...base, language: 'en' },
    });
    const swedish = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { ...base, language: 'sv' },
    });

    expect(english.statusCode).toBe(201);
    expect(swedish.statusCode).toBe(201);
    expect(english.json().book.id).not.toBe(swedish.json().book.id);
    expect(english.json().book.language).toBe('en');
    expect(swedish.json().book.language).toBe('sv');
  });

  it('rejects adding the same book twice', async () => {
    vi.mocked(lookupByIsbn).mockResolvedValue({ title: 'Dup Book', source: 'open-library', isbn13: '9780000000099' });
    const { cookie } = await registerUser(app, 'e@example.com');

    const first = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '9780000000099' },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '9780000000099' },
    });
    expect(second.statusCode).toBe(409);
  });

  it('lists, filters, updates and deletes a household book', async () => {
    const { cookie } = await registerUser(app, 'f@example.com');
    vi.mocked(lookupByIsbn).mockResolvedValueOnce({
      title: 'Nordic Tides',
      authorName: 'E. Sorensen',
      source: 'open-library',
      isbn13: '9780000000100',
    });
    const added = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '9780000000100' },
    });
    const id = added.json().id;

    const list = await app.inject({ method: 'GET', url: '/household-books', cookies: { session: cookie } });
    expect(list.json()).toHaveLength(1);

    const searched = await app.inject({
      method: 'GET',
      url: '/household-books?search=nordic',
      cookies: { session: cookie },
    });
    expect(searched.json()).toHaveLength(1);

    const missed = await app.inject({
      method: 'GET',
      url: '/household-books?search=zzz',
      cookies: { session: cookie },
    });
    expect(missed.json()).toHaveLength(0);

    const updated = await app.inject({
      method: 'PATCH',
      url: `/household-books/${id}`,
      cookies: { session: cookie },
      payload: { status: 'wishlist', conditionNote: 'Good' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().status).toBe('wishlist');

    const deleted = await app.inject({ method: 'DELETE', url: `/household-books/${id}`, cookies: { session: cookie } });
    expect(deleted.statusCode).toBe(204);

    const afterDelete = await app.inject({
      method: 'GET',
      url: `/household-books/${id}`,
      cookies: { session: cookie },
    });
    expect(afterDelete.statusCode).toBe(404);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await app.inject({ method: 'GET', url: '/household-books' });
    expect(res.statusCode).toBe(401);
  });

  it('corrects wrong metadata on a book, visible to every household that owns it', async () => {
    vi.mocked(lookupByIsbn).mockResolvedValueOnce({
      title: 'Mistyped Titel',
      authorName: 'Wrong Author',
      source: 'open-library',
      isbn13: '9780000000200',
    });
    const alice = await registerUser(app, 'alice-fix@example.com');
    const bob = await registerUser(app, 'bob-fix@example.com');

    const aliceAdd = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: alice.cookie },
      payload: { isbn: '9780000000200' },
    });
    const bobAdd = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: bob.cookie },
      payload: { isbn: '9780000000200' },
    });
    const bookId = aliceAdd.json().book.id;
    expect(bobAdd.json().book.id).toBe(bookId);

    const fixed = await app.inject({
      method: 'PATCH',
      url: `/books/${bookId}`,
      cookies: { session: alice.cookie },
      payload: { title: 'The Correct Title', authorName: 'Right Author', language: 'en' },
    });
    expect(fixed.statusCode).toBe(200);
    expect(fixed.json()).toMatchObject({ title: 'The Correct Title', language: 'en' });
    expect(fixed.json().author.name).toBe('Right Author');

    const bobsCopy = await app.inject({
      method: 'GET',
      url: `/household-books/${bobAdd.json().id}`,
      cookies: { session: bob.cookie },
    });
    expect(bobsCopy.json().book.title).toBe('The Correct Title');
  });

  it('sets series/volume and clears them again on a book', async () => {
    const { cookie } = await registerUser(app, 'series-edit@example.com');
    const added = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { title: 'Standalone Novel' },
    });
    const bookId = added.json().book.id;

    const withSeries = await app.inject({
      method: 'PATCH',
      url: `/books/${bookId}`,
      cookies: { session: cookie },
      payload: { seriesName: 'The Lantern Cycle', volumeNumber: 2 },
    });
    expect(withSeries.statusCode).toBe(200);
    expect(withSeries.json()).toMatchObject({ volumeNumber: 2 });
    expect(withSeries.json().series.name).toBe('The Lantern Cycle');

    const cleared = await app.inject({
      method: 'PATCH',
      url: `/books/${bookId}`,
      cookies: { session: cookie },
      payload: { seriesName: '' },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json().series).toBeNull();
    expect(cleared.json().volumeNumber).toBeNull();
  });

  it('rejects setting a series with no volume number, but allows renaming a series without repeating it', async () => {
    const { cookie } = await registerUser(app, 'series-edit-guard@example.com');
    const added = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { title: 'Standalone Novel Two' },
    });
    const bookId = added.json().book.id;

    const rejected = await app.inject({
      method: 'PATCH',
      url: `/books/${bookId}`,
      cookies: { session: cookie },
      payload: { seriesName: 'Harry Potter' },
    });
    expect(rejected.statusCode).toBe(400);

    const withSeries = await app.inject({
      method: 'PATCH',
      url: `/books/${bookId}`,
      cookies: { session: cookie },
      payload: { seriesName: 'Harry Potter', volumeNumber: 1 },
    });
    expect(withSeries.statusCode).toBe(200);

    // Renaming the series without resending volumeNumber is fine — it's still set from before.
    const renamed = await app.inject({
      method: 'PATCH',
      url: `/books/${bookId}`,
      cookies: { session: cookie },
      payload: { seriesName: 'Harry Potter and the Philosopher’s Stone' },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json().volumeNumber).toBe(1);
  });

  it('exports the household library as csv', async () => {
    vi.mocked(lookupByIsbn).mockResolvedValueOnce({
      title: 'The Ember Road',
      authorName: 'Mira Voss',
      seriesName: 'The Lantern Cycle',
      volumeNumber: 3,
      language: 'en',
      isbn13: '9780000000300',
      source: 'open-library',
    });
    const { cookie } = await registerUser(app, 'export@example.com');

    await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '9780000000300' },
    });
    await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { title: 'A "Quoted" Title, With Comma' },
    });

    const res = await app.inject({ method: 'GET', url: '/household-books/export.csv', cookies: { session: cookie } });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');

    const lines = res.body.trim().split('\r\n');
    expect(lines[0]).toBe('Title,Author,Series,Volume,Language,ISBN-13,ISBN-10,Status,Condition Note,Added At');
    expect(lines).toHaveLength(3);
    expect(lines.some((l) => l.startsWith('The Ember Road,Mira Voss,The Lantern Cycle,3,en,9780000000300'))).toBe(true);
    expect(lines.some((l) => l.includes('"A ""Quoted"" Title, With Comma"'))).toBe(true);
  });

  it('exports an empty csv with just headers for a household with no books', async () => {
    const { cookie } = await registerUser(app, 'export-empty@example.com');

    const res = await app.inject({ method: 'GET', url: '/household-books/export.csv', cookies: { session: cookie } });

    expect(res.statusCode).toBe(200);
    expect(res.body.trim()).toBe('Title,Author,Series,Volume,Language,ISBN-13,ISBN-10,Status,Condition Note,Added At');
  });

  it('404s editing a book the household does not own', async () => {
    vi.mocked(lookupByIsbn).mockResolvedValueOnce({
      title: 'Someone Elses Book',
      source: 'open-library',
      isbn13: '9780000000201',
    });
    const owner = await registerUser(app, 'owner-fix@example.com');
    const stranger = await registerUser(app, 'stranger-fix@example.com');

    const added = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: owner.cookie },
      payload: { isbn: '9780000000201' },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/books/${added.json().book.id}`,
      cookies: { session: stranger.cookie },
      payload: { title: 'Hijacked' },
    });
    expect(res.statusCode).toBe(404);
  });
});
