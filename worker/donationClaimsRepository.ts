import { Client } from 'pg'

export type DonationClaimInput = {
  claimId: string
  eventId: string
  advertiserUid: string
  serverId: string
  packageCode: string
  donorReference: string
  createdAt: string
}

type QueryResult = { rowCount: number | null }
export type TransactionClient = {
  query: (text: string, values?: readonly unknown[]) => Promise<QueryResult>
}

export class ClaimConflictError extends Error {}
export class ClaimDetailsError extends Error {}

export async function withPrimaryDatabase<T>(connectionString: string, work: (client: TransactionClient) => Promise<T>) {
  const client = new Client({ connectionString })
  await client.connect()
  try {
    return await work(client)
  } finally {
    await client.end()
  }
}

export async function insertDonationClaim(client: TransactionClient, input: DonationClaimInput) {
  await client.query('BEGIN')
  try {
    const server = await client.query(
      "SELECT id FROM public.server WHERE id = $1::uuid AND owner_uid = $2 AND status = 'active' FOR KEY SHARE",
      [input.serverId, input.advertiserUid],
    )
    const adPackage = await client.query(
      "SELECT code FROM public.ad_package WHERE code = $1 AND is_active = true AND tier = 'exclusive' AND duration_days IN (7, 30) FOR KEY SHARE",
      [input.packageCode],
    )
    if (server.rowCount !== 1 || adPackage.rowCount !== 1) throw new ClaimDetailsError()

    await client.query(
      "INSERT INTO public.donation_claim (id, advertiser_uid, server_id, package_code, donor_reference, status, created_at) VALUES ($1::uuid, $2, $3::uuid, $4, $5, 'pending', $6::timestamptz)",
      [input.claimId, input.advertiserUid, input.serverId, input.packageCode, input.donorReference, input.createdAt],
    )
    await client.query(
      "INSERT INTO public.donation_review_event (id, claim_id, actor_uid, action, created_at) VALUES ($1::uuid, $2::uuid, $3, 'submitted', $4::timestamptz)",
      [input.eventId, input.claimId, input.advertiserUid, input.createdAt],
    )
    await client.query('COMMIT')
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch (rollbackError) {
      console.error(JSON.stringify({ event: 'claim_transaction_rollback_failed', error: rollbackError instanceof Error ? rollbackError.name : 'unknown' }))
    }
    if (isPostgresError(error) && error.code === '23505') throw new ClaimConflictError()
    throw error
  }
}

function isPostgresError(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
}
