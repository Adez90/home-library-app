import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';

export async function findOrCreateAuthor(tx: Prisma.TransactionClient, name: string) {
  return tx.author.upsert({ where: { name }, update: {}, create: { name } });
}

export async function findOrCreateSeries(tx: Prisma.TransactionClient, name: string) {
  return tx.series.upsert({ where: { name }, update: {}, create: { name } });
}

// A volume number can exist as several editions (languages) — each is its own catalog row,
// but they represent the same "slot" in the story, so completion is counted once per slot:
// owned in ANY language counts. A book with no volume number (can't be grouped) is its own slot.
export function computeSlotCompletion(volumes: { id: string; volumeNumber: number | null; status: string }[]): {
  ownedCount: number;
  totalCount: number;
} {
  const slotKey = (v: (typeof volumes)[number]) => (v.volumeNumber != null ? `v:${v.volumeNumber}` : `id:${v.id}`);
  const slots = new Map<string, boolean>();
  for (const v of volumes) {
    const key = slotKey(v);
    slots.set(key, (slots.get(key) ?? false) || v.status === 'owned');
  }
  return { ownedCount: [...slots.values()].filter(Boolean).length, totalCount: slots.size };
}

// Live completion for a series within a household — used by both the series page and the
// favorites list, so a favorited series always reflects what's actually been scanned so far.
export async function getSeriesCompletion(householdId: string, seriesId: string): Promise<{ ownedCount: number; totalCount: number }> {
  const books = await prisma.book.findMany({ where: { seriesId }, select: { id: true, volumeNumber: true } });
  const householdBooks = await prisma.householdBook.findMany({
    where: { householdId, bookId: { in: books.map((b) => b.id) } },
    select: { bookId: true, status: true },
  });
  const statusByBookId = new Map(householdBooks.map((hb) => [hb.bookId, hb.status]));
  const volumes = books.map((b) => ({ id: b.id, volumeNumber: b.volumeNumber, status: statusByBookId.get(b.id) ?? 'missing' }));
  return computeSlotCompletion(volumes);
}

// How many books by this author the household already owns — live, so favoriting an author
// before owning anything of theirs still updates the moment one gets scanned in.
export async function getAuthorOwnedCount(householdId: string, authorId: string): Promise<number> {
  return prisma.householdBook.count({ where: { householdId, status: 'owned', book: { authorId } } });
}
