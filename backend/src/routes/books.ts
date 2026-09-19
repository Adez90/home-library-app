import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { lookupByIsbn } from '../lib/metadata.js';
import { getPrimaryHouseholdId } from '../lib/household.js';
import { findOrCreateAuthor, findOrCreateSeries } from '../lib/catalog.js';

const STATUSES = ['owned', 'wishlist', 'hunting'] as const;

const addBookSchema = z
  .object({
    isbn: z.string().min(8).optional(),
    title: z.string().min(1).optional(),
    authorName: z.string().min(1).optional(),
    seriesName: z.string().min(1).optional(),
    volumeNumber: z.coerce.number().int().positive().optional(),
    language: z.string().min(2).max(8).optional(),
    status: z.enum(STATUSES).default('owned'),
  })
  .refine((data) => data.isbn || data.title, { message: 'Provide either isbn or title' });

const updateBookSchema = z.object({
  status: z.enum(STATUSES).optional(),
  conditionNote: z.string().max(2000).optional(),
});

// All fields optional; a present-but-empty string clears that field (author/series/language/
// cover). A book's title can't be cleared, only changed. volumeNumber is a number to set it,
// or null to clear it.
const updateBookDetailsSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  authorName: z.string().max(200).optional(),
  seriesName: z.string().max(200).optional(),
  volumeNumber: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  language: z.string().max(8).optional(),
  coverUrl: z.string().max(2000).optional(),
});

function normalizeIsbn(isbn: string) {
  return isbn.replace(/[^0-9Xx]/g, '');
}

// Only reachable when there's no ISBN to key off (manual entry, or a scanned ISBN with no
// metadata match). Reuses an existing catalog row with an exact match on the fields that
// distinguish one edition from another, so two "the same book" manual adds — by the same
// household or a different one — don't create duplicate rows. Different languages are
// legitimately different editions and are NOT merged.
async function findExistingBookByDetails(
  tx: Prisma.TransactionClient,
  details: { title: string; authorId: string | null; seriesId: string | null; volumeNumber: number | null; language: string | null },
) {
  return tx.book.findFirst({
    where: {
      title: { equals: details.title, mode: 'insensitive' },
      authorId: details.authorId,
      seriesId: details.seriesId,
      volumeNumber: details.volumeNumber,
      language: details.language,
      isbn13: null,
      isbn10: null,
    },
  });
}

const bookInclude = { author: true, series: true } as const;

function serializeBook(book: {
  id: string;
  title: string;
  isbn13: string | null;
  isbn10: string | null;
  coverUrl: string | null;
  volumeNumber: number | null;
  language: string | null;
  author: { id: string; name: string } | null;
  series: { id: string; name: string } | null;
}) {
  return {
    id: book.id,
    title: book.title,
    isbn13: book.isbn13,
    isbn10: book.isbn10,
    coverUrl: book.coverUrl,
    volumeNumber: book.volumeNumber,
    language: book.language,
    author: book.author,
    series: book.series,
  };
}

function serializeHouseholdBook(hb: {
  id: string;
  status: string;
  conditionNote: string | null;
  addedAt: Date;
  book: {
    id: string;
    title: string;
    isbn13: string | null;
    isbn10: string | null;
    coverUrl: string | null;
    volumeNumber: number | null;
    language: string | null;
    author: { id: string; name: string } | null;
    series: { id: string; name: string } | null;
  };
}) {
  return {
    id: hb.id,
    status: hb.status,
    conditionNote: hb.conditionNote,
    addedAt: hb.addedAt,
    book: {
      id: hb.book.id,
      title: hb.book.title,
      isbn13: hb.book.isbn13,
      isbn10: hb.book.isbn10,
      coverUrl: hb.book.coverUrl,
      volumeNumber: hb.book.volumeNumber,
      language: hb.book.language,
      author: hb.book.author,
      series: hb.book.series,
    },
  };
}

export async function registerBookRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.post('/household-books', async (request, reply) => {
    const parsed = addBookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const {
      isbn,
      title,
      authorName,
      seriesName: manualSeriesName,
      volumeNumber: manualVolumeNumber,
      language: manualLanguage,
      status,
    } = parsed.data;
    const householdId = await getPrimaryHouseholdId(request.user.userId);

    const normalizedIsbn = isbn ? normalizeIsbn(isbn) : undefined;

    let book = normalizedIsbn
      ? await prisma.book.findFirst({ where: { OR: [{ isbn13: normalizedIsbn }, { isbn10: normalizedIsbn }] } })
      : null;

    if (!book) {
      let resolvedTitle = title;
      let resolvedAuthorName = authorName;
      let seriesName: string | undefined;
      let volumeNumber: number | undefined;
      let language: string | undefined;
      let coverUrl: string | undefined;
      let isbn13: string | undefined;
      let isbn10: string | undefined;

      if (normalizedIsbn) {
        const metadata = await lookupByIsbn(normalizedIsbn);
        if (metadata) {
          resolvedTitle = metadata.title;
          resolvedAuthorName = metadata.authorName ?? resolvedAuthorName;
          seriesName = metadata.seriesName;
          volumeNumber = metadata.volumeNumber;
          language = metadata.language;
          coverUrl = metadata.coverUrl;
          isbn13 = metadata.isbn13 ?? (normalizedIsbn.length === 13 ? normalizedIsbn : undefined);
          isbn10 = metadata.isbn10 ?? (normalizedIsbn.length === 10 ? normalizedIsbn : undefined);
        } else if (!title) {
          return reply.code(404).send({
            error: 'No book found for that ISBN. Try entering the title manually.',
          });
        } else {
          isbn13 = normalizedIsbn.length === 13 ? normalizedIsbn : undefined;
          isbn10 = normalizedIsbn.length === 10 ? normalizedIsbn : undefined;
        }
      }

      if (!resolvedTitle) {
        return reply.code(404).send({ error: 'No book found for that ISBN. Try entering the title manually.' });
      }

      // Manual series/language info always wins — it's what the person is telling us, not a guess.
      seriesName = manualSeriesName ?? seriesName;
      volumeNumber = manualVolumeNumber ?? volumeNumber;
      language = manualLanguage ?? language;

      book = await prisma.$transaction(async (tx) => {
        const author = resolvedAuthorName ? await findOrCreateAuthor(tx, resolvedAuthorName) : null;
        const series = seriesName ? await findOrCreateSeries(tx, seriesName) : null;

        // No ISBN to key off (manual entry, or a scan whose ISBN had no metadata match) —
        // reuse an existing exact match instead of creating a duplicate catalog row.
        if (!isbn13 && !isbn10) {
          const existingManual = await findExistingBookByDetails(tx, {
            title: resolvedTitle!,
            authorId: author?.id ?? null,
            seriesId: series?.id ?? null,
            volumeNumber: volumeNumber ?? null,
            language: language ?? null,
          });
          if (existingManual) return existingManual;
        }

        return tx.book.create({
          data: {
            title: resolvedTitle!,
            isbn13,
            isbn10,
            coverUrl,
            volumeNumber,
            language,
            authorId: author?.id,
            seriesId: series?.id,
          },
        });
      });
    }

    const existing = await prisma.householdBook.findUnique({
      where: { householdId_bookId: { householdId, bookId: book.id } },
    });
    if (existing) {
      return reply.code(409).send({ error: 'This book is already in your library' });
    }

    const householdBook = await prisma.householdBook.create({
      data: { householdId, bookId: book.id, status },
      include: { book: { include: bookInclude } },
    });

    return reply.code(201).send(serializeHouseholdBook(householdBook));
  });

  app.get('/household-books', async (request) => {
    const householdId = await getPrimaryHouseholdId(request.user.userId);
    const query = request.query as { status?: string; search?: string };

    const where: Prisma.HouseholdBookWhereInput = { householdId };
    if (query.status && (STATUSES as readonly string[]).includes(query.status)) {
      where.status = query.status;
    }
    if (query.search) {
      where.book = {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { author: { name: { contains: query.search, mode: 'insensitive' } } },
        ],
      };
    }

    const householdBooks = await prisma.householdBook.findMany({
      where,
      include: { book: { include: bookInclude } },
      orderBy: { addedAt: 'desc' },
    });

    return householdBooks.map(serializeHouseholdBook);
  });

  const CSV_HEADER = ['Title', 'Author', 'Series', 'Volume', 'Language', 'ISBN-13', 'ISBN-10', 'Status', 'Condition Note', 'Added At'];

  function csvField(value: string | number | null | undefined): string {
    const str = value == null ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  // A plain CSV backup — every competitor in this space offers one, and it's the only way to
  // get the catalog out of the app if the server ever goes away.
  app.get('/household-books/export.csv', async (request, reply) => {
    const householdId = await getPrimaryHouseholdId(request.user.userId);

    const householdBooks = await prisma.householdBook.findMany({
      where: { householdId },
      include: { book: { include: bookInclude } },
      orderBy: { book: { title: 'asc' } },
    });

    const rows = householdBooks.map((hb) =>
      [
        hb.book.title,
        hb.book.author?.name,
        hb.book.series?.name,
        hb.book.volumeNumber,
        hb.book.language,
        hb.book.isbn13,
        hb.book.isbn10,
        hb.status,
        hb.conditionNote,
        hb.addedAt.toISOString(),
      ]
        .map(csvField)
        .join(','),
    );

    const csv = [CSV_HEADER.join(','), ...rows].join('\r\n') + '\r\n';

    reply.header('content-type', 'text/csv; charset=utf-8');
    reply.header('content-disposition', 'attachment; filename="home-library.csv"');
    return reply.send(csv);
  });

  app.get('/household-books/:id', async (request, reply) => {
    const householdId = await getPrimaryHouseholdId(request.user.userId);
    const { id } = request.params as { id: string };

    const householdBook = await prisma.householdBook.findFirst({
      where: { id, householdId },
      include: { book: { include: bookInclude } },
    });
    if (!householdBook) {
      return reply.code(404).send({ error: 'Not found' });
    }
    return serializeHouseholdBook(householdBook);
  });

  app.patch('/household-books/:id', async (request, reply) => {
    const parsed = updateBookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const householdId = await getPrimaryHouseholdId(request.user.userId);
    const { id } = request.params as { id: string };

    const existing = await prisma.householdBook.findFirst({ where: { id, householdId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Not found' });
    }

    const updated = await prisma.householdBook.update({
      where: { id },
      data: parsed.data,
      include: { book: { include: bookInclude } },
    });
    return serializeHouseholdBook(updated);
  });

  app.delete('/household-books/:id', async (request, reply) => {
    const householdId = await getPrimaryHouseholdId(request.user.userId);
    const { id } = request.params as { id: string };

    const existing = await prisma.householdBook.findFirst({ where: { id, householdId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Not found' });
    }

    await prisma.householdBook.delete({ where: { id } });
    return reply.code(204).send();
  });

  // Corrects the shared catalog row itself (title/author/series/volume/language/cover), not
  // household-specific state. Scanned or looked-up metadata is sometimes wrong — a misread
  // barcode, or the source's own data error — and until now there was no way to fix it short
  // of deleting and re-adding, which re-fetches the same wrong data for the same ISBN. Since
  // the row is shared by ISBN across households, a correction here is visible to everyone who
  // owns that book, which is the right outcome for data that was objectively wrong.
  app.patch('/books/:id', async (request, reply) => {
    const parsed = updateBookDetailsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }
    const householdId = await getPrimaryHouseholdId(request.user.userId);
    const { id } = request.params as { id: string };

    const owned = await prisma.householdBook.findFirst({ where: { householdId, bookId: id } });
    if (!owned) {
      return reply.code(404).send({ error: 'Not found' });
    }

    const { title, authorName, seriesName, volumeNumber, language, coverUrl } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const data: Prisma.BookUpdateInput = {};

      if (title !== undefined) data.title = title.trim();

      if (authorName !== undefined) {
        const trimmed = authorName.trim();
        if (trimmed) {
          const author = await findOrCreateAuthor(tx, trimmed);
          data.author = { connect: { id: author.id } };
        } else {
          data.author = { disconnect: true };
        }
      }

      let clearingSeries = false;
      if (seriesName !== undefined) {
        const trimmed = seriesName.trim();
        if (trimmed) {
          const series = await findOrCreateSeries(tx, trimmed);
          data.series = { connect: { id: series.id } };
        } else {
          data.series = { disconnect: true };
          data.volumeNumber = null;
          clearingSeries = true;
        }
      }

      if (!clearingSeries && volumeNumber !== undefined) {
        data.volumeNumber = volumeNumber;
      }

      if (language !== undefined) data.language = language.trim() || null;
      if (coverUrl !== undefined) data.coverUrl = coverUrl.trim() || null;

      return tx.book.update({ where: { id }, data, include: bookInclude });
    });

    return serializeBook(updated);
  });
}
