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
});
