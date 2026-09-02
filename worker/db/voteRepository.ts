import { Client } from 'pg'
import type { RankingQueryClient } from './rankingRepository'

export type VoteResult = { recorded: boolean; votes: number } | null
export type VoteRepository = { castDailyVote(serverId: string, voterKey: Uint8Array): Promise<VoteResult> }
type VoteRow = { recorded: boolean; votes: string }

export function createVoteRepository(createClient: () => RankingQueryClient): VoteRepository {
  return {
    async castDailyVote(serverId, voterKey) {
      const client = createClient()
      try {
        await client.connect()
        const result = await client.query<VoteRow>(
          'SELECT recorded, votes::text AS votes FROM api.cast_daily_vote($1::uuid, $2::bytea)',
          [serverId, voterKey],
        )
        const row = result.rows[0]
        if (!row) return null
        const votes = Number(row.votes)
        if (!Number.isSafeInteger(votes) || votes < 0) throw new Error('Invalid vote count')
        return { recorded: row.recorded, votes }
      } finally {
        await client.end()
      }
    },
  }
}

export function createHyperdriveVoteRepository(connectionString: string): VoteRepository {
  return createVoteRepository(() => new Client({ connectionString }))
}

