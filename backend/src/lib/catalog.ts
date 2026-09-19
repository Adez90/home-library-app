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
//
// totalCount is at least the number of distinct slots actually in the catalog, but for a
// numbered series (manga, most book series) owning volume 28 with nothing else scanned in
// still implies at least 28 volumes exist — nobody publishes a "volume 28" as the first one.
// expectedVolumeCount is an optional household-set override (there's no reliable external
// source for "how many volumes are in this series" — see the schema comment) that wins when
// it's the largest of the three, e.g. a completed series someone's typed the real count in for.
export function computeSlotCompletion(
  volumes: { id: string; volumeNumber: number | null; status: string }[],
  expectedVolumeCount?: number | null,
): {
  ownedCount: number;
  totalCount: number;
} {
  const slotKey = (v: (typeof volumes)[number]) => (v.volumeNumber != null ? `v:${v.volumeNumber}` : `id:${v.id}`);
  const slots = new Map<string, boolean>();
  let highestVolumeNumber = 0;
  for (const v of volumes) {
    const key = slotKey(v);
    slots.set(key, (slots.get(key) ?? false) || v.status === 'owned');
    if (v.volumeNumber != null && v.volumeNumber > highestVolumeNumber) highestVolumeNumber = v.volumeNumber;
  }
  const totalCount = Math.max(slots.size, highestVolumeNumber, expectedVolumeCount ?? 0);
  return { ownedCount: [...slots.values()].filter(Boolean).length, totalCount };
}

// Live completion for a series within a household — used by both the series page and the
// favorites list, so a favorited series always reflects what's actually been scanned so far.
export async function getSeriesCompletion(householdId: string, seriesId: string): Promise<{ ownedCount: number; totalCount: number }> {
  const series = await prisma.series.findUnique({ where: { id: seriesId }, select: { expectedVolumeCount: true } });
  const books = await prisma.book.findMany({ where: { seriesId }, select: { id: true, volumeNumber: true } });
  const householdBooks = await prisma.householdBook.findMany({
    where: { householdId, bookId: { in: books.map((b) => b.id) } },
    select: { bookId: true, status: true },
  });
  const statusByBookId = new Map(householdBooks.map((hb) => [hb.bookId, hb.status]));
  const volumes = books.map((b) => ({ id: b.id, volumeNumber: b.volumeNumber, status: statusByBookId.get(b.id) ?? 'missing' }));
  return computeSlotCompletion(volumes, series?.expectedVolumeCount);
}

// How many books by this author the household already owns — live, so favoriting an author
// before owning anything of theirs still updates the moment one gets scanned in.
export async function getAuthorOwnedCount(householdId: string, authorId: string): Promise<number> {
  return prisma.householdBook.count({ where: { householdId, status: 'owned', book: { authorId } } });
}
