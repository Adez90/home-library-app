export interface BookMetadata {
  isbn13?: string;
  isbn10?: string;
  title: string;
  authorName?: string;
  seriesName?: string;
  volumeNumber?: number;
  coverUrl?: string;
  source: 'open-library' | 'google-books';
}

export type FetchLike = typeof fetch;

function parseSeriesEntry(entry: string): { seriesName: string; volumeNumber?: number } {
  // Open Library series entries look like "Harry Potter #1" or just "Harry Potter".
  const match = entry.match(/^(.*)\s+#(\d+)\s*$/);
  if (match) {
    return { seriesName: match[1].trim(), volumeNumber: Number(match[2]) };
  }
  return { seriesName: entry.trim() };
}

async function lookupOpenLibrary(isbn: string, fetchImpl: FetchLike): Promise<BookMetadata | null> {
  const res = await fetchImpl(`https://openlibrary.org/isbn/${isbn}.json`);
  if (!res.ok) return null;
  const edition = (await res.json()) as {
    title?: string;
    authors?: { key: string }[];
    covers?: number[];
    isbn_13?: string[];
    isbn_10?: string[];
    series?: string[];
  };
  if (!edition.title) return null;

  let authorName: string | undefined;
  const authorKey = edition.authors?.[0]?.key;
  if (authorKey) {
    const authorRes = await fetchImpl(`https://openlibrary.org${authorKey}.json`);
    if (authorRes.ok) {
      const author = (await authorRes.json()) as { name?: string };
      authorName = author.name;
    }
  }

  const seriesEntry = edition.series?.[0];
  const seriesInfo = seriesEntry ? parseSeriesEntry(seriesEntry) : undefined;

  return {
    title: edition.title,
    authorName,
    seriesName: seriesInfo?.seriesName,
    volumeNumber: seriesInfo?.volumeNumber,
    isbn13: edition.isbn_13?.[0],
    isbn10: edition.isbn_10?.[0],
    coverUrl: edition.covers?.[0] ? `https://covers.openlibrary.org/b/id/${edition.covers[0]}-L.jpg` : undefined,
    source: 'open-library',
  };
}

async function lookupGoogleBooks(isbn: string, fetchImpl: FetchLike): Promise<BookMetadata | null> {
  const res = await fetchImpl(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    items?: { volumeInfo?: { title?: string; authors?: string[]; imageLinks?: { thumbnail?: string } } }[];
  };
  const info = data.items?.[0]?.volumeInfo;
  if (!info?.title) return null;

  return {
    title: info.title,
    authorName: info.authors?.[0],
    coverUrl: info.imageLinks?.thumbnail,
    isbn13: isbn.length === 13 ? isbn : undefined,
    isbn10: isbn.length === 10 ? isbn : undefined,
    source: 'google-books',
  };
}

export async function lookupByIsbn(isbn: string, fetchImpl: FetchLike = fetch): Promise<BookMetadata | null> {
  const normalized = isbn.replace(/[^0-9Xx]/g, '');

  try {
    const fromOpenLibrary = await lookupOpenLibrary(normalized, fetchImpl);
    if (fromOpenLibrary) return fromOpenLibrary;
  } catch {
    // fall through to the next provider
  }

  try {
    const fromGoogleBooks = await lookupGoogleBooks(normalized, fetchImpl);
    if (fromGoogleBooks) return fromGoogleBooks;
  } catch {
    // both providers failed or had nothing — caller treats this as "not found"
  }

  return null;
}
