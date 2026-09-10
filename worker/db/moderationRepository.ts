import { Client } from 'pg'
import type { RankingQueryClient } from './rankingRepository'

export type ListingSnapshot={name:string;website:string;gameVersion:string;region:string;mode:string;description:string}
export type PendingSubmission = { id:string;gameSlug:string;gameName:string;name:string;website:string;gameVersion:string;region:string;mode:string;description:string;submittedAt:string;requestType:'new'|'change';currentListing?:ListingSnapshot }
export type ModerationOutcome = { outcome: 'approved'; serverId: string } | { outcome: 'rejected' | 'already_resolved' | 'duplicate' | 'game_unavailable' }
export type ModerationRepository = {
  listPending(): Promise<PendingSubmission[]>
  decide(id: string, moderatorKey: Uint8Array, decision: 'approve' | 'reject', reasonCode: string | undefined, operationId: string): Promise<ModerationOutcome>
}
type PendingRow = { id:string;game_slug:string;game_name:string;name:string;website:string;game_version:string;region:string;mode:string;description:string;created_at:Date|string;current_name?:string;current_website?:string;current_game_version?:string;current_region?:string;current_mode?:string;current_description?:string }
type OutcomeRow = { outcome: string; server_id: string | null }

export function createModerationRepository(createClient: () => RankingQueryClient): ModerationRepository {
  async function connected<T>(operation: (client: RankingQueryClient) => Promise<T>): Promise<T> {
    const client = createClient()
    try { await client.connect(); return await operation(client) } finally { await client.end() }
  }
  return {
    listPending: () => connected(async (client) => {
      const [submissions,changes]=await Promise.all([client.query<PendingRow>('SELECT * FROM api.list_pending_server_submissions()'),client.query<PendingRow>('SELECT * FROM api.list_pending_server_listing_changes()')])
      return [...submissions.rows.map(row=>({row,requestType:'new' as const})),...changes.rows.map(row=>({row,requestType:'change' as const}))].sort((a,b)=>new Date(a.row.created_at).getTime()-new Date(b.row.created_at).getTime()).map(({row,requestType}) => ({ id: row.id, gameSlug: row.game_slug, gameName: row.game_name, name: row.name, website: row.website, gameVersion: row.game_version, region: row.region, mode: row.mode, description: row.description, submittedAt: new Date(row.created_at).toISOString(), status: 'pending' as const,requestType,...(requestType==='change'?{currentListing:{name:String(row.current_name),website:String(row.current_website),gameVersion:String(row.current_game_version),region:String(row.current_region),mode:String(row.current_mode),description:String(row.current_description)}}:{}) }))
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
