import { Client } from 'pg'
import type { ApprovedServer, GameRankings, RankingServer } from '../contracts/rankings'

type QueryResult<Row> = { rows: Row[] }

export type RankingQueryClient = {
  connect(): Promise<unknown>
  query<Row extends Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<QueryResult<Row>>
  end(): Promise<void>
}

export type RankingRepository = {
  findByGameSlug(gameSlug: string): Promise<GameRankings | null>
  listApprovedServers(): Promise<ApprovedServer[]>
}

type GameRow = { slug: string; name: string }
type ServerRow = {
  id: string
  name: string
  website: string
  votes: string
  game_version: string | null
  region: string | null
  mode: 'PvE' | 'PvP' | 'RPG' | null
  description: string | null
  banner_id: string | null
  banner_alt_text: string | null
}
type ApprovedServerRow = ServerRow & { game_slug: string; game_name: string }

function mapServer({ id, name, website, votes, game_version, region, mode, description, banner_id, banner_alt_text }: ServerRow): RankingServer {
  const numericVotes = Number(votes)
  if (!Number.isSafeInteger(numericVotes) || numericVotes < 0) throw new Error('Invalid public vote count')
  const parsedWebsite = new URL(website)
  if (parsedWebsite.protocol !== 'https:' || parsedWebsite.username || parsedWebsite.password) throw new Error('Invalid public website')
  const banner = banner_id && banner_alt_text ? { id: banner_id, altText: banner_alt_text } : null
  return { id, name, website: parsedWebsite.href, votes: numericVotes, gameVersion: game_version ?? null, region: region ?? null, mode: mode ?? null, description: description ?? null, banner }
}

export function createRankingRepository(createClient: () => RankingQueryClient): RankingRepository {
  return {
    async findByGameSlug(gameSlug) {
      const client = createClient()
      try {
        await client.connect()
        const gameResult = await client.query<GameRow>(
          'SELECT slug, name FROM api.public_games WHERE slug = $1 LIMIT 1',
          [gameSlug],
        )
        const game = gameResult.rows[0]
        if (!game) return null

        const serverResult = await client.query<ServerRow>(
          `SELECT id::text AS id, name, website, vote_count::text AS votes,
                  game_version, region, mode, description,
                  banner_id::text AS banner_id, banner_alt_text
             FROM api.public_rankings
            WHERE game_slug = $1
            ORDER BY vote_count DESC, created_at ASC, id ASC
            LIMIT 100`,
          [gameSlug],
        )
        const servers = serverResult.rows.map(mapServer)
        return { game, servers }
      } finally {
        await client.end()
      }
    },
    async listApprovedServers() {
      const client = createClient()
      try {
        await client.connect()
        const result = await client.query<ApprovedServerRow>(
          `SELECT r.id::text AS id, r.name, r.website, r.vote_count::text AS votes,
                  r.game_version, r.region, r.mode, r.description,
                  r.banner_id::text AS banner_id, r.banner_alt_text,
                  g.slug AS game_slug, g.name AS game_name
             FROM api.public_rankings r
             JOIN api.public_games g ON g.slug = r.game_slug
            ORDER BY r.created_at DESC, r.id ASC
            LIMIT 100`,
        )
        return result.rows.map((row) => ({
          ...mapServer(row),
          game: { slug: row.game_slug, name: row.game_name },
        }))
      } finally {
        await client.end()
      }
    },
  }
}

export function createHyperdriveRankingRepository(connectionString: string): RankingRepository {
  return createRankingRepository(() => new Client({ connectionString }))
}
