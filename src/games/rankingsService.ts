export type PublicRankingServer = { id: string; name: string; votes: number }

export type PublicGameRankings = {
  game: { slug: string; name: string }
  servers: PublicRankingServer[]
}

export type RankingsService = {
  getGameRankings: (gameSlug: string, signal?: AbortSignal) => Promise<PublicGameRankings>
}

const API_ORIGIN = 'https://api.mmorpgtop100.com'

function isRankingServer(value: unknown): value is PublicRankingServer {
  if (!value || typeof value !== 'object') return false
  const server = value as Record<string, unknown>
  return typeof server.id === 'string' && typeof server.name === 'string' &&
    typeof server.votes === 'number' && Number.isSafeInteger(server.votes) && server.votes >= 0
}

function parseRankings(value: unknown, expectedSlug: string): PublicGameRankings {
  if (!value || typeof value !== 'object') throw new Error('Invalid rankings response')
  const payload = value as Record<string, unknown>
  const game = payload.game
  const servers = payload.servers
  if (payload.ok !== true || !game || typeof game !== 'object' ||
    (game as Record<string, unknown>).slug !== expectedSlug ||
    typeof (game as Record<string, unknown>).name !== 'string' || !Array.isArray(servers) ||
    servers.length > 100 || !servers.every(isRankingServer)) {
    throw new Error('Invalid rankings response')
  }
  return {
    game: { slug: expectedSlug, name: (game as Record<string, unknown>).name as string },
    servers,
  }
}

export function createRankingsService(fetcher: typeof fetch = fetch, apiOrigin = API_ORIGIN): RankingsService {
  return {
    async getGameRankings(gameSlug, signal) {
      const response = await fetcher(`${apiOrigin}/api/games/${encodeURIComponent(gameSlug)}/rankings`, {
        headers: { accept: 'application/json' }, signal,
      })
      if (!response.ok) throw new Error('Rankings request failed')
      return parseRankings(await response.json(), gameSlug)
    },
  }
}

export const rankingsService = createRankingsService()
