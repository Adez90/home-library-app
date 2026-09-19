import { Link } from 'react-router-dom'
import type { HouseholdBook } from '../lib/types'
import { LanguageBadge } from './LanguageBadge'
import { CheckIcon } from './icons'

const PLACEHOLDER_COLORS = ['#3F6B5C', '#6B5B95', '#A64B4B', '#4A6FA5', '#8C6E4A', '#557A6B', '#B08968']

function colorFor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return PLACEHOLDER_COLORS[hash % PLACEHOLDER_COLORS.length]
}

interface BookCardProps {
  item: HouseholdBook
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
}

export function BookCard({ item, selectable, selected, onToggleSelect }: BookCardProps) {
  const { book } = item

  const cover = (
    <div
      className="relative w-full aspect-[2/3] rounded-lg flex items-end p-2 overflow-hidden bg-cover bg-center"
      style={{
        backgroundColor: colorFor(book.title),
        backgroundImage: book.coverUrl ? `url(${book.coverUrl})` : undefined,
      }}
    >
      {!book.coverUrl && (
        <span className="font-heading text-white text-xs font-bold leading-tight drop-shadow">{book.title}</span>
      )}
      {selectable && (
        <span
          className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center border-2 ${
            selected ? 'bg-accent border-accent' : 'bg-white/70 border-white'
          }`}
        >
          {selected && <CheckIcon width={14} height={14} className="text-white" />}
        </span>
      )}
    </div>
  )

  const details = (
    <>
      <div className="text-sm font-semibold leading-tight group-hover:text-accent">{book.title}</div>
      <div className="flex items-center gap-1.5">
        {book.author && <span className="text-xs text-text-secondary">{book.author.name}</span>}
        <LanguageBadge language={book.language} />
      </div>
    </>
  )

  if (selectable) {
    return (
      <button
        type="button"
        onClick={() => onToggleSelect?.(item.id)}
        className="flex flex-col gap-2 group text-left"
        aria-pressed={!!selected}
      >
        {cover}
        {details}
      </button>
    )
  }

  return (
    <Link to={`/library/${item.id}`} className="flex flex-col gap-2 group">
      {cover}
      {details}
    </Link>
  )
}
