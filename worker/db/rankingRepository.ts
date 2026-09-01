import { Client } from 'pg'
import type { GameRankings, RankingServer } from '../contracts/rankings'

type QueryResult<Row> = { rows: Row[] }

export type RankingQueryClient = {
  connect(): Promise<unknown>
  query<Row extends Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<QueryResult<Row>>
  end(): Promise<void>
}

export type RankingRepository = {
  findByGameSlug(gameSlug: string): Promise<GameRankings | null>
}

type GameRow = { slug: string; name: string }
type ServerRow = { id: string; name: string; votes: string }

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
          `SELECT id::text AS id, name, vote_count::text AS votes
             FROM api.public_rankings
            WHERE game_slug = $1
            ORDER BY vote_count DESC, created_at ASC, id ASC
            LIMIT 100`,
          [gameSlug],
        )
        const servers: RankingServer[] = serverResult.rows.map(({ id, name, votes }) => {
          const numericVotes = Number(votes)
          if (!Number.isSafeInteger(numericVotes) || numericVotes < 0) throw new Error('Invalid public vote count')
          return { id, name, votes: numericVotes }
        })
        return { game, servers }
      } finally {
        await client.end()
      }
    },
  }
}

export function createHyperdriveRankingRepository(connectionString: string): RankingRepository {
  return createRankingRepository(() => new Client({ connectionString }))
}
