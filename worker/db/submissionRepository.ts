import { Client } from 'pg'
import type { RankingQueryClient } from './rankingRepository'

export type NewServerSubmission = {
  ownerKey: Uint8Array
  gameSlug: string
  name: string
  website: string
  websiteHost: string
  gameVersion: string
  region: string
  mode: 'PvE' | 'PvP' | 'RPG'
  description: string
}
export type SubmissionOutcome = { outcome: 'accepted'; submissionId: string } | { outcome: 'duplicate' | 'game_unavailable' | 'limit_reached' }
export type SubmissionRepository = { submit(input: NewServerSubmission): Promise<SubmissionOutcome> }
type SubmissionRow = { outcome: string; submission_id: string | null }

export function createSubmissionRepository(createClient: () => RankingQueryClient): SubmissionRepository {
  return {
    async submit(input) {
      const client = createClient()
      try {
        await client.connect()
        const result = await client.query<SubmissionRow>(
          `SELECT outcome, submission_id::text AS submission_id
             FROM api.submit_server($1::bytea, $2::varchar, $3::varchar, $4::text,
                                    $5::varchar, $6::varchar, $7::varchar, $8::varchar, $9::varchar)`,
          [input.ownerKey, input.gameSlug, input.name, input.website, input.websiteHost, input.gameVersion, input.region, input.mode, input.description],
        )
        const row = result.rows[0]
        if (row?.outcome === 'accepted' && row.submission_id) return { outcome: 'accepted', submissionId: row.submission_id }
        if (row?.outcome === 'duplicate' || row?.outcome === 'game_unavailable' || row?.outcome === 'limit_reached') return { outcome: row.outcome }
        throw new Error('Invalid submission outcome')
      } finally {
        await client.end()
      }
    },
  }
}

export function createHyperdriveSubmissionRepository(connectionString: string): SubmissionRepository {
  return createSubmissionRepository(() => new Client({ connectionString }))
}
