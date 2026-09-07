export type PublicRankingServer = {
  id: string
  name: string
  website: string
  votes: number
  gameVersion: string | null
  region: string | null
  mode: 'PvE' | 'PvP' | 'RPG' | null
  description: string | null
  banner: { url: string; staticUrl: string; altText: string } | null
}

export type PublicGameRankings = {
  game: { slug: string; name: string }
  servers: PublicRankingServer[]
}

export type RankingsService = {
  getGameRankings: (gameSlug: string, signal?: AbortSignal) => Promise<PublicGameRankings>
}

const API_ORIGIN = 'https://api.mmorpgtop100.com'

function parseRankingServer(value: unknown, apiOrigin: string): PublicRankingServer | null {
  if (!value || typeof value !== 'object') return null
  const server = value as Record<string, unknown>
  let website: URL
  try { website = new URL(String(server.website)) } catch { return null }
  const gameVersion = server.gameVersion ?? null
  const region = server.region ?? null
  const mode = server.mode ?? null
  const description = server.description ?? null
  const valid = typeof server.id === 'string' && typeof server.name === 'string' &&
    website.protocol === 'https:' && !website.username && !website.password &&
    typeof server.votes === 'number' && Number.isSafeInteger(server.votes) && server.votes >= 0 &&
    (gameVersion === null || (typeof gameVersion === 'string' && gameVersion.length <= 60)) &&
    (region === null || (typeof region === 'string' && region.length <= 60)) &&
    (mode === null || ['PvE', 'PvP', 'RPG'].includes(String(mode))) &&
    (description === null || (typeof description === 'string' && description.length <= 1000))
  if (!valid) return null
  let banner: PublicRankingServer['banner'] = null
  if (server.banner !== null && server.banner !== undefined) {
    if (!server.banner || typeof server.banner !== 'object') return null
    const candidate = server.banner as Record<string, unknown>
    if (typeof candidate.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate.id) ||
      typeof candidate.altText !== 'string' || candidate.altText.length < 10 || candidate.altText.length > 160) return null
    const url = new URL(`/api/advertising/banners/${candidate.id}`, apiOrigin)
    const staticUrl = new URL(url); staticUrl.searchParams.set('static', '1')
    banner = { url: url.href, staticUrl: staticUrl.href, altText: candidate.altText }
  }
  return { id: server.id as string, name: server.name as string, website: website.href, votes: server.votes as number,
    gameVersion: gameVersion as string | null, region: region as string | null,
    mode: mode as PublicRankingServer['mode'], description: description as string | null, banner }
}

function parseRankings(value: unknown, expectedSlug: string, apiOrigin: string): PublicGameRankings {
  if (!value || typeof value !== 'object') throw new Error('Invalid rankings response')
  const payload = value as Record<string, unknown>
  const game = payload.game
  const servers = payload.servers
  if (payload.ok !== true || !game || typeof game !== 'object' ||
    (game as Record<string, unknown>).slug !== expectedSlug ||
    typeof (game as Record<string, unknown>).name !== 'string' || !Array.isArray(servers) || servers.length > 100) {
    throw new Error('Invalid rankings response')
  }
  const parsedServers = servers.map((server) => parseRankingServer(server, apiOrigin))
  if (parsedServers.some((server) => server === null)) throw new Error('Invalid rankings response')
  return {
    game: { slug: expectedSlug, name: (game as Record<string, unknown>).name as string },
    servers: parsedServers as PublicRankingServer[],
  }
}

export function createRankingsService(fetcher: typeof fetch = fetch, apiOrigin = API_ORIGIN): RankingsService {
  return {
    async getGameRankings(gameSlug, signal) {
      const response = await fetcher(`${apiOrigin}/api/games/${encodeURIComponent(gameSlug)}/rankings`, {
        headers: { accept: 'application/json' }, signal,
      })
      if (!response.ok) throw new Error('Rankings request failed')
      return parseRankings(await response.json(), gameSlug, apiOrigin)
    },
  }
}

export const rankingsService = createRankingsService()
