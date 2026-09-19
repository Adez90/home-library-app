import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { getPrimaryHouseholdId } from '../lib/household.js';
import { computeSlotCompletion } from '../lib/catalog.js';

const updateSeriesSchema = z.object({
  // null explicitly clears it back to "unknown, infer from the highest volume number seen".
  expectedVolumeCount: z.union([z.coerce.number().int().positive().max(5000), z.null()]),
});

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

  const { ownedCount, totalCount } = computeSlotCompletion(volumes, series.expectedVolumeCount);

  // Numbered gaps implied by the highest volume number (or an explicit expectedVolumeCount)
  // but with no catalog row yet — surfaced as "missing" placeholders so a household scanning
  // in just volume 28 of a manga immediately sees "27 more to look for", not just a bare count.
  const knownVolumeNumbers = new Set(volumes.map((v) => v.volumeNumber).filter((n): n is number => n != null));
  const placeholders = [];
  for (let n = 1; n <= totalCount; n++) {
    if (!knownVolumeNumbers.has(n)) {
      placeholders.push({
        id: `missing:${seriesId}:${n}`,
        title: '',
        volumeNumber: n,
        language: null,
        isbn13: null,
        coverUrl: null,
        author: null,
        status: 'missing' as const,
      });
    }
  }
  const allVolumes = [...volumes, ...placeholders].sort((a, b) => {
    if (a.volumeNumber == null || b.volumeNumber == null) return (a.volumeNumber == null ? 1 : 0) - (b.volumeNumber == null ? 1 : 0);
    return a.volumeNumber - b.volumeNumber;
  });

  const languages = [...new Set(volumes.map((v) => v.language).filter((l): l is string => !!l))].sort();

  return {
    id: series.id,
    name: series.name,
    volumes: allVolumes,
    ownedCount,
    totalCount,
    expectedVolumeCount: series.expectedVolumeCount,
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

  // Sets (or, with null, clears) the household's own guess at the series' real total volume
  // count — there's no reliable external source for this (see the schema comment on
  // Series.expectedVolumeCount), so it's a plain editable field rather than something looked
  // up. Same ownership rule as PATCH /books/:id: only a household that actually has something
  // in this series can edit it, since it's shared, catalog-wide data.
  app.patch('/series/:id', async (request, reply) => {
    const parsed = updateSeriesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const householdId = await getPrimaryHouseholdId(request.user.userId);
    const { id } = request.params as { id: string };

    const owned = await prisma.householdBook.findFirst({ where: { householdId, book: { seriesId: id } } });
    if (!owned) {
      return reply.code(404).send({ error: 'Not found' });
    }

    await prisma.series.update({ where: { id }, data: { expectedVolumeCount: parsed.data.expectedVolumeCount } });

    const detail = await buildSeriesDetail(id, householdId);
    return detail;
  });
}
