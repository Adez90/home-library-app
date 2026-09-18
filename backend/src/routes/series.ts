import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { getPrimaryHouseholdId } from '../lib/household.js';

async function buildSeriesDetail(seriesId: string, householdId: string) {
  const series = await prisma.series.findUnique({ where: { id: seriesId } });
  if (!series) return null;

  const books = await prisma.book.findMany({
    where: { seriesId },
    include: { author: true },
    orderBy: [{ volumeNumber: 'asc' }, { title: 'asc' }],
  });

  const householdBooks = await prisma.householdBook.findMany({
    where: { householdId, bookId: { in: books.map((b) => b.id) } },
  });
  const statusByBookId = new Map(householdBooks.map((hb) => [hb.bookId, hb.status]));

  const volumes = books.map((book) => ({
    id: book.id,
    title: book.title,
    volumeNumber: book.volumeNumber,
    language: book.language,
    isbn13: book.isbn13,
    coverUrl: book.coverUrl,
    author: book.author,
    status: statusByBookId.get(book.id) ?? 'missing',
  }));

  // A volume number can exist as several editions (languages) — each is its own catalog
  // row, but they represent the same "slot" in the story, so completion is counted once
  // per slot: owned in ANY language counts. A book with no volume number (can't be grouped)
  // is its own slot.
  const slotKey = (v: (typeof volumes)[number]) => (v.volumeNumber != null ? `v:${v.volumeNumber}` : `id:${v.id}`);
  const slots = new Map<string, boolean>();
  for (const v of volumes) {
    const key = slotKey(v);
    slots.set(key, (slots.get(key) ?? false) || v.status === 'owned');
  }
  const ownedCount = [...slots.values()].filter(Boolean).length;
  const languages = [...new Set(volumes.map((v) => v.language).filter((l): l is string => !!l))].sort();

  return {
    id: series.id,
    name: series.name,
    volumes,
    ownedCount,
    totalCount: slots.size,
    languages,
  };
}

export async function registerSeriesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/series', async (request) => {
    const householdId = await getPrimaryHouseholdId(request.user.userId);

    const householdBooks = await prisma.householdBook.findMany({
      where: { householdId },
      include: { book: true },
    });
    const seriesIds = [...new Set(householdBooks.map((hb) => hb.book.seriesId).filter((id): id is string => !!id))];

    const details = await Promise.all(seriesIds.map((id) => buildSeriesDetail(id, householdId)));
    return details.filter((d) => d !== null);
  });

  app.get('/series/:id', async (request, reply) => {
    const householdId = await getPrimaryHouseholdId(request.user.userId);
    const { id } = request.params as { id: string };

    const detail = await buildSeriesDetail(id, householdId);
    if (!detail) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return detail;
  });
}
