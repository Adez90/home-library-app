import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { lookupByIsbn } from '../lib/metadata.js';
import { getPrimaryHouseholdId } from '../lib/household.js';

const STATUSES = ['owned', 'wishlist', 'hunting'] as const;

const addBookSchema = z
  .object({
    isbn: z.string().min(8).optional(),
    title: z.string().min(1).optional(),
    authorName: z.string().min(1).optional(),
    status: z.enum(STATUSES).default('owned'),
  })
  .refine((data) => data.isbn || data.title, { message: 'Provide either isbn or title' });

const updateBookSchema = z.object({
  status: z.enum(STATUSES).optional(),
  conditionNote: z.string().max(2000).optional(),
});

function normalizeIsbn(isbn: string) {
  return isbn.replace(/[^0-9Xx]/g, '');
}

async function findOrCreateAuthor(tx: Prisma.TransactionClient, name: string) {
  return tx.author.upsert({ where: { name }, update: {}, create: { name } });
}

async function findOrCreateSeries(tx: Prisma.TransactionClient, name: string) {
  return tx.series.upsert({ where: { name }, update: {}, create: { name } });
}

const bookInclude = { author: true, series: true } as const;

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
    const { isbn, title, authorName, status } = parsed.data;
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

      book = await prisma.$transaction(async (tx) => {
        const author = resolvedAuthorName ? await findOrCreateAuthor(tx, resolvedAuthorName) : null;
        const series = seriesName ? await findOrCreateSeries(tx, seriesName) : null;
        return tx.book.create({
          data: {
            title: resolvedTitle!,
            isbn13,
            isbn10,
            coverUrl,
            volumeNumber,
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
}
