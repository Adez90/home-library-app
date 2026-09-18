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
});
