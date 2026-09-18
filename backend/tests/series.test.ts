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

describe('series completion', () => {
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

  it('shows owned volumes as owned and other known volumes as missing', async () => {
    const { cookie } = await registerUser(app, 'series@example.com');

    vi.mocked(lookupByIsbn).mockResolvedValueOnce({
      title: 'Book 1',
      authorName: 'Mira Voss',
      seriesName: 'The Lantern Cycle',
      volumeNumber: 1,
      isbn13: '9780000000201',
      source: 'open-library',
    });
    const owned = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '9780000000201' },
    });
    expect(owned.statusCode).toBe(201);
    const seriesId = owned.json().book.series.id;

    vi.mocked(lookupByIsbn).mockResolvedValueOnce({
      title: 'Book 2',
      authorName: 'Mira Voss',
      seriesName: 'The Lantern Cycle',
      volumeNumber: 2,
      isbn13: '9780000000202',
      source: 'open-library',
    });
    const wanted = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '9780000000202', status: 'hunting' },
    });
    expect(wanted.statusCode).toBe(201);

    const detail = await app.inject({
      method: 'GET',
      url: `/series/${seriesId}`,
      cookies: { session: cookie },
    });
    expect(detail.statusCode).toBe(200);
    const body = detail.json();
    expect(body.name).toBe('The Lantern Cycle');
    expect(body.ownedCount).toBe(1);
    expect(body.totalCount).toBe(2);
    expect(body.volumes.map((v: { status: string }) => v.status)).toEqual(['owned', 'hunting']);

    const list = await app.inject({ method: 'GET', url: '/series', cookies: { session: cookie } });
    expect(list.json()).toHaveLength(1);
  });

  it('counts a volume owned in any language as one completed slot, and lists distinct languages', async () => {
    const { cookie } = await registerUser(app, 'multilingual@example.com');

    vi.mocked(lookupByIsbn).mockResolvedValueOnce({
      title: 'Throne of Glass',
      authorName: 'Sarah J. Maas',
      seriesName: 'Throne of Glass',
      volumeNumber: 1,
      language: 'en',
      isbn13: '9780000000301',
      source: 'open-library',
    });
    const english = await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '9780000000301' },
    });
    const seriesId = english.json().book.series.id;

    vi.mocked(lookupByIsbn).mockResolvedValueOnce({
      title: 'Glasslott',
      authorName: 'Sarah J. Maas',
      seriesName: 'Throne of Glass',
      volumeNumber: 1,
      language: 'sv',
      isbn13: '9780000000302',
      source: 'open-library',
    });
    await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '9780000000302' },
    });

    vi.mocked(lookupByIsbn).mockResolvedValueOnce({
      title: 'Crown of Midnight',
      authorName: 'Sarah J. Maas',
      seriesName: 'Throne of Glass',
      volumeNumber: 2,
      language: 'en',
      isbn13: '9780000000303',
      source: 'open-library',
    });
    await app.inject({
      method: 'POST',
      url: '/household-books',
      cookies: { session: cookie },
      payload: { isbn: '9780000000303', status: 'hunting' },
    });

    const detail = await app.inject({ method: 'GET', url: `/series/${seriesId}`, cookies: { session: cookie } });
    const body = detail.json();

    // Volume 1 owned in two languages is still ONE completed slot; volume 2 (hunting only) is not owned.
    expect(body.ownedCount).toBe(1);
    expect(body.totalCount).toBe(2);
    expect(body.languages).toEqual(['en', 'sv']);
    expect(body.volumes).toHaveLength(3);
  });

  it('404s for a series id that does not exist', async () => {
    const { cookie } = await registerUser(app, 'noseries@example.com');
    const res = await app.inject({
      method: 'GET',
      url: '/series/00000000-0000-0000-0000-000000000000',
      cookies: { session: cookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
