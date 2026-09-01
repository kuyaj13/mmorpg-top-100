export const GAME_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type RankingServer = {
  id: string
  name: string
  website: string
  votes: number
}

export type GameRankings = {
  game: { slug: string; name: string }
  servers: RankingServer[]
}

export type ApprovedServer = RankingServer & {
  game: { slug: string; name: string }
}

export function parseGameSlug(value: string): string | null {
  if (value.length === 0 || value.length > 100 || !GAME_SLUG_PATTERN.test(value)) return null
  return value
}
