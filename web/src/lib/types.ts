export interface User {
  id: string
  email: string
  name: string
}

export interface Household {
  id: string
  name: string
  role: string
  inviteCode: string
}

export interface AuthorRef {
  id: string
  name: string
}

export interface SeriesRef {
  id: string
  name: string
}

export type BookStatus = 'owned' | 'wishlist' | 'hunting'

export interface HouseholdBook {
  id: string
  status: BookStatus
  conditionNote: string | null
  addedAt: string
  book: {
    id: string
    title: string
    isbn13: string | null
    isbn10: string | null
    coverUrl: string | null
    volumeNumber: number | null
    language: string | null
    author: AuthorRef | null
    series: SeriesRef | null
  }
}

export type VolumeStatus = BookStatus | 'missing'

export interface SeriesVolume {
  id: string
  title: string
  volumeNumber: number | null
  language: string | null
  isbn13: string | null
  coverUrl: string | null
  author: AuthorRef | null
  status: VolumeStatus
}

export interface SeriesDetail {
  id: string
  name: string
  volumes: SeriesVolume[]
  ownedCount: number
  totalCount: number
  languages: string[]
}

export interface Favorite {
  id: string
  targetType: 'author' | 'series'
  targetId: string
  name?: string
}
