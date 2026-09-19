export interface BookMetadata {
  isbn13?: string;
  isbn10?: string;
  title: string;
  authorName?: string;
  seriesName?: string;
  volumeNumber?: number;
  language?: string;
  format?: string;
  coverUrl?: string;
  source: 'open-library' | 'libris' | 'google-books';
}

export type FetchLike = typeof fetch;

// Open Library keys editions by MARC 3-letter code (e.g. "/languages/swe"); map the
// common ones to ISO 639-1 for a consistent, compact language field. An unmapped code
// still gets stored as-is — better to show "swe" than to drop it.
const MARC_TO_ISO_639_1: Record<string, string> = {
  eng: 'en',
  swe: 'sv',
  fre: 'fr',
  fra: 'fr',
  ger: 'de',
  deu: 'de',
  spa: 'es',
  ita: 'it',
  dan: 'da',
  nor: 'no',
  fin: 'fi',
  dut: 'nl',
  nld: 'nl',
  por: 'pt',
  pol: 'pl',
  rus: 'ru',
  jpn: 'ja',
};

function marcToIso(code: string): string {
  return MARC_TO_ISO_639_1[code] ?? code;
}

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
    languages?: { key: string }[];
    physical_format?: string;
  };
  if (!edition.title) return null;

  const languageKey = edition.languages?.[0]?.key; // "/languages/eng"
  const language = languageKey ? marcToIso(languageKey.replace('/languages/', '')) : undefined;

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
    language,
    format: edition.physical_format,
    coverUrl: edition.covers?.[0] ? `https://covers.openlibrary.org/b/id/${edition.covers[0]}-L.jpg` : undefined,
    source: 'open-library',
  };
}

// LIBRIS (the Swedish National Library's catalogue) fills in Swedish-language books, including
// smaller Swedish presses, that Open Library and Google Books often don't have. Its Xsearch API
// field names are documented loosely (public docs describe the URL shape and output formats but
// not a full JSON schema) — this is written defensively and falls through to null on anything
// unexpected, the same as every other provider here, so a wrong field name just means "not found"
// rather than breaking the lookup chain.
async function lookupLibris(isbn: string, fetchImpl: FetchLike): Promise<BookMetadata | null> {
  const res = await fetchImpl(`https://libris.kb.se/xsearch?query=isbn:${isbn}&format=json&n=1`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    xsearch?: {
      records?: number | string;
      list?: { title?: string; creator?: string; language?: string }[];
    };
  };

  const record = data.xsearch?.list?.[0];
  if (!record?.title) return null;

  return {
    title: record.title,
    authorName: record.creator,
    language: record.language ? marcToIso(record.language) : undefined,
    isbn13: isbn.length === 13 ? isbn : undefined,
    isbn10: isbn.length === 10 ? isbn : undefined,
    source: 'libris',
  };
}

async function lookupGoogleBooks(isbn: string, fetchImpl: FetchLike): Promise<BookMetadata | null> {
  const res = await fetchImpl(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    items?: {
      volumeInfo?: { title?: string; authors?: string[]; language?: string; imageLinks?: { thumbnail?: string } };
    }[];
  };
  const info = data.items?.[0]?.volumeInfo;
  if (!info?.title) return null;

  return {
    title: info.title,
    authorName: info.authors?.[0],
    language: info.language,
    coverUrl: info.imageLinks?.thumbnail,
    isbn13: isbn.length === 13 ? isbn : undefined,
    isbn10: isbn.length === 10 ? isbn : undefined,
    source: 'google-books',
  };
}

// A provider failing is expected sometimes (no record for this ISBN, a timeout) and always
// falls through silently to the next one — that behavior doesn't change. But "expected" isn't
// the same as "invisible": logging at warn means a provider that's misbehaving systematically
// (wrong field mapping, an outage) shows up in the logs instead of just quietly degrading to
// worse metadata forever. No logger given (e.g. in tests) is a safe no-op.
export interface MinimalLogger {
  warn: (obj: unknown, msg?: string) => void;
}
const noopLogger: MinimalLogger = { warn: () => {} };

export async function lookupByIsbn(
  isbn: string,
  fetchImpl: FetchLike = fetch,
  log: MinimalLogger = noopLogger,
): Promise<BookMetadata | null> {
  const normalized = isbn.replace(/[^0-9Xx]/g, '');

  try {
    const fromOpenLibrary = await lookupOpenLibrary(normalized, fetchImpl);
    if (fromOpenLibrary) return fromOpenLibrary;
  } catch (err) {
    log.warn({ err, provider: 'open-library', isbn: normalized }, 'ISBN metadata provider failed');
  }

  try {
    const fromLibris = await lookupLibris(normalized, fetchImpl);
    if (fromLibris) return fromLibris;
  } catch (err) {
    log.warn({ err, provider: 'libris', isbn: normalized }, 'ISBN metadata provider failed');
  }

  try {
    const fromGoogleBooks = await lookupGoogleBooks(normalized, fetchImpl);
    if (fromGoogleBooks) return fromGoogleBooks;
  } catch (err) {
    log.warn({ err, provider: 'google-books', isbn: normalized }, 'ISBN metadata provider failed');
  }

  return null;
}
