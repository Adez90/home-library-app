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
  return { cookie };
}

describe('favorites', () => {
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

  it('favorites an author, lists it, and rejects a duplicate', async () => {
    const { cookie } = await registerUser(app, 'fav@example.com');

    vi.mocked(lookupByIsbn).mockResolvedValueOnce({
      title: 'The Ember Road',
      authorName: 'Mira Voss',
      source: 'open-library',
      isbn13: '9780000000301',
    });
    const added = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '9780000000301' },
    });
    const authorId = added.json().book.author.id;

    const fav = await app.inject({
      method: 'POST',
      url: '/favorites',
      cookies: { session: cookie },
      payload: { targetType: 'author', targetId: authorId },
    });
    expect(fav.statusCode).toBe(201);
    expect(fav.json().name).toBe('Mira Voss');

    const dup = await app.inject({
      method: 'POST',
      url: '/favorites',
      cookies: { session: cookie },
      payload: { targetType: 'author', targetId: authorId },
    });
    expect(dup.statusCode).toBe(409);

    const list = await app.inject({ method: 'GET', url: '/favorites', cookies: { session: cookie } });
    expect(list.json()).toHaveLength(1);

    const id = fav.json().id;
    const del = await app.inject({ method: 'DELETE', url: `/favorites/${id}`, cookies: { session: cookie } });
    expect(del.statusCode).toBe(204);

    const listAfter = await app.inject({ method: 'GET', url: '/favorites', cookies: { session: cookie } });
    expect(listAfter.json()).toHaveLength(0);
  });

  it('404s when favoriting an author id that does not exist', async () => {
    const { cookie } = await registerUser(app, 'fav2@example.com');
    const res = await app.inject({
      method: 'POST',
      url: '/favorites',
      cookies: { session: cookie },
      payload: { targetType: 'author', targetId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('favorites an author by name with no existing book, at zero owned', async () => {
    const { cookie } = await registerUser(app, 'byname@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/favorites',
      cookies: { session: cookie },
      payload: { targetType: 'author', name: 'Brandon Sanderson' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.name).toBe('Brandon Sanderson');
    expect(body.ownedCount).toBe(0);
    expect(body.totalCount).toBeUndefined();
  });

  it('favorites a series by name with no existing book, at zero of zero', async () => {
    const { cookie } = await registerUser(app, 'byname2@example.com');

    const res = await app.inject({
      method: 'POST',
      url: '/favorites',
      cookies: { session: cookie },
      payload: { targetType: 'series', name: 'The Stormlight Archive' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: 'The Stormlight Archive', ownedCount: 0, totalCount: 0 });
  });

  it('reuses the same author when favorited by name twice, and rejects the duplicate', async () => {
    const { cookie } = await registerUser(app, 'byname3@example.com');
    const payload = { targetType: 'author' as const, name: 'Mira Voss' };

    const first = await app.inject({ method: 'POST', url: '/favorites', cookies: { session: cookie }, payload });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({ method: 'POST', url: '/favorites', cookies: { session: cookie }, payload });
    expect(second.statusCode).toBe(409);
  });

  it('updates an author favorite’s owned count live once a book by them is scanned in', async () => {
    const { cookie } = await registerUser(app, 'live@example.com');

    const fav = await app.inject({
      method: 'POST',
      url: '/favorites',
      cookies: { session: cookie },
      payload: { targetType: 'author', name: 'Mira Voss' },
    });
    expect(fav.json().ownedCount).toBe(0);

    vi.mocked(lookupByIsbn).mockResolvedValueOnce({
      title: 'The Ember Road',
      authorName: 'Mira Voss',
      source: 'open-library',
      isbn13: '9780000000501',
    });
    const added = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '9780000000501' },
    });
    expect(added.statusCode).toBe(201);

    const list = await app.inject({ method: 'GET', url: '/favorites', cookies: { session: cookie } });
    expect(list.json()[0].ownedCount).toBe(1);
  });

  it('updates a series favorite’s completion live once a volume is scanned in', async () => {
    const { cookie } = await registerUser(app, 'live2@example.com');

    const fav = await app.inject({
      method: 'POST',
      url: '/favorites',
      cookies: { session: cookie },
      payload: { targetType: 'series', name: 'The Lantern Cycle' },
    });
    expect(fav.json()).toMatchObject({ ownedCount: 0, totalCount: 0 });

    vi.mocked(lookupByIsbn).mockResolvedValueOnce({
      title: 'Book 1',
      seriesName: 'The Lantern Cycle',
      volumeNumber: 1,
      source: 'open-library',
      isbn13: '9780000000502',
    });
    await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '9780000000502' },
    });

    const list = await app.inject({ method: 'GET', url: '/favorites', cookies: { session: cookie } });
    expect(list.json()[0]).toMatchObject({ ownedCount: 1, totalCount: 1 });
  });
});
