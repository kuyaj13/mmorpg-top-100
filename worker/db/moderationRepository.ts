import { Client } from 'pg'
import type { RankingQueryClient } from './rankingRepository'

export type PendingSubmission = { id: string; gameSlug: string; gameName: string; name: string; website: string; gameVersion: string; region: string; mode: string; description: string; submittedAt: string }
export type ModerationOutcome = { outcome: 'approved'; serverId: string } | { outcome: 'rejected' | 'already_resolved' | 'duplicate' | 'game_unavailable' }
export type ModerationRepository = {
  listPending(): Promise<PendingSubmission[]>
  decide(id: string, moderatorKey: Uint8Array, decision: 'approve' | 'reject', reasonCode: string | undefined, operationId: string): Promise<ModerationOutcome>
}
type PendingRow = { id: string; game_slug: string; game_name: string; name: string; website: string; game_version: string; region: string; mode: string; description: string; created_at: Date | string }
type OutcomeRow = { outcome: string; server_id: string | null }

export function createModerationRepository(createClient: () => RankingQueryClient): ModerationRepository {
  async function connected<T>(operation: (client: RankingQueryClient) => Promise<T>): Promise<T> {
    const client = createClient()
    try { await client.connect(); return await operation(client) } finally { await client.end() }
  }
  return {
    listPending: () => connected(async (client) => {
      const [submissions,changes]=await Promise.all([client.query<PendingRow>('SELECT * FROM api.list_pending_server_submissions()'),client.query<PendingRow>('SELECT id,game_slug,game_name,name,website,game_version,region,mode,description,created_at FROM api.list_pending_server_listing_changes()')])
      return [...submissions.rows,...changes.rows].sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()).map((row) => ({ id: row.id, gameSlug: row.game_slug, gameName: row.game_name, name: row.name, website: row.website, gameVersion: row.game_version, region: row.region, mode: row.mode, description: row.description, submittedAt: new Date(row.created_at).toISOString(), status: 'pending' as const }))
    }),
    decide: (id, moderatorKey, decision, reasonCode, operationId) => connected(async (client) => {
      const result = await client.query<OutcomeRow>(
        'SELECT outcome, server_id::text AS server_id FROM api.moderate_server_submission($1::uuid, $2::bytea, $3::varchar, $4::varchar, $5::uuid)',
        [id, moderatorKey, decision, reasonCode ?? null, operationId],
      )
      const row = result.rows[0]
      if (row?.outcome === 'approved' && row.server_id) return { outcome: 'approved', serverId: row.server_id }
      if(row?.outcome==='already_resolved'){const changed=await client.query<{outcome:string}>('SELECT api.moderate_server_listing_change($1::uuid,$2::bytea,$3::varchar,$4::varchar,$5::uuid) AS outcome',[id,moderatorKey,decision,reasonCode??null,operationId]);const outcome=changed.rows[0]?.outcome;if(outcome==='approved')return{outcome:'approved',serverId:id};if(outcome==='rejected'||outcome==='duplicate'||outcome==='unavailable')return{outcome:outcome==='unavailable'?'already_resolved':outcome} as ModerationOutcome}
      if (row?.outcome === 'rejected' || row?.outcome === 'already_resolved' || row?.outcome === 'duplicate' || row?.outcome === 'game_unavailable') return { outcome: row.outcome }
      throw new Error('Invalid moderation outcome')
    }),
  }
}

export function createHyperdriveModerationRepository(connectionString: string): ModerationRepository {
  return createModerationRepository(() => new Client({ connectionString }))
}
