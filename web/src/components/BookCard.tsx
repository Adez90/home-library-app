import { Link } from 'react-router-dom'
import type { HouseholdBook } from '../lib/types'
import { LanguageBadge } from './LanguageBadge'

const PLACEHOLDER_COLORS = ['#3F6B5C', '#6B5B95', '#A64B4B', '#4A6FA5', '#8C6E4A', '#557A6B', '#B08968']

function colorFor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length]
}

export function BookCard({ item }: { item: HouseholdBook }) {
  const { book } = item

  return (
    <Link to={`/library/${item.id}`} className="flex flex-col gap-2 group">
      <div
        className="w-full aspect-[2/3] rounded-lg flex items-end p-2 overflow-hidden bg-cover bg-center"
        style={{
          backgroundColor: colorFor(book.title),
          backgroundImage: book.coverUrl ? `url(${book.coverUrl})` : undefined,
        }}
      >
        {!book.coverUrl && (
          <span className="font-heading text-white text-xs font-bold leading-tight drop-shadow">{book.title}</span>
        )}
      </div>
      <div className="text-sm font-semibold leading-tight group-hover:text-accent">{book.title}</div>
      <div className="flex items-center gap-1.5">
        {book.author && <span className="text-xs text-text-secondary">{book.author.name}</span>}
        <LanguageBadge language={book.language} />
      </div>
    </Link>
  )
}
