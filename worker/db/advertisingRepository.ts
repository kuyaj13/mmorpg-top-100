import { Client } from 'pg'
import type { SanitizedBanner } from '../bannerValidation'
import type { RankingQueryClient } from './rankingRepository'

export type PublicAd = { id: string; serverId: string; serverName: string; bannerId: string; mediaType: string; altText: string; destinationUrl: string; startsAt: string; expiresAt: string }
export type PendingBanner = { id: string; serverId: string; serverName: string; gameSlug: string; bannerKind: 'free'|'exclusive'; mediaType: string; byteSize: number; width: number; height: number; frameCount: number; animationDurationMs: number; altText: string; createdAt: string }
export type OwnedServer = { id: string; name: string; gameSlug: string; gameName: string }
export type AdPackage = { code:string;durationDays:7|30;tier:string;priceMinor:string;currency:string }
export type OwnerDonationClaim = { id:string;serverName:string;gameName:string;durationDays:number;status:'pending'|'verified'|'rejected';createdAt:string;rejectionReason?:string }
export type PendingDonationClaim = { id: string; serverName: string; gameName: string; website: string; donorReference: string; durationDays: number; expectedAmountMinor: string; currency: string; createdAt: string }
export type BannerModerationOutcome = 'approved' | 'rejected' | 'suspended' | 'unavailable'
export type DonationModerationOutcome = 'verified' | 'rejected' | 'invalid' | 'unavailable'
export type DonationClaimOutcome = { outcome: 'accepted'; claimId: string } | { outcome: 'invalid'|'unavailable'|'limit_reached'|'duplicate' }
export type AdminPlacement = { id:string;serverName:string;website:string;gameSlug:string;gameName:string;durationDays:number;status:'active'|'waiting'|'suspended'|'expired';startsAt:string|null;expiresAt:string|null;queuedAt:string;bannerStatus:string;claimStatus:string;impressionCount:number }
export type PlacementModerationOutcome='suspend'|'reactivate'|'expired'|'ineligible'|'inventory_full'|'invalid'|'unavailable'
export type AdvertisingRepository = {
  putBanner(serverId: string, ownerKey: Uint8Array, banner: SanitizedBanner, altText: string): Promise<'stored' | 'unavailable'>
  putExclusiveBanner(serverId: string, ownerKey: Uint8Array, banner: SanitizedBanner, altText: string): Promise<'stored' | 'unavailable'>
  listOwnedServers(ownerKey: Uint8Array): Promise<OwnedServer[]>
  listExclusiveEligibleServers?(ownerKey: Uint8Array): Promise<OwnedServer[]>
  listActivePackages():Promise<AdPackage[]>
  listOwnerDonationClaims(ownerKey:Uint8Array):Promise<OwnerDonationClaim[]>
  submitDonationClaim(ownerKey: Uint8Array, serverId: string, packageCode: string, donorReference: string): Promise<DonationClaimOutcome>
  listPendingDonationClaims(): Promise<PendingDonationClaim[]>
  moderateDonationClaim(id: string, moderatorKey: Uint8Array, decision: 'verify'|'reject', reasonCode: string|null, operationId: string): Promise<DonationModerationOutcome>
  listPublic(gameSlug: string): Promise<PublicAd[]>
  recordImpression(placementId: string): Promise<'recorded'|'unavailable'>
  getPublicBanner(id: string, staticFallback: boolean): Promise<{ bytes: Uint8Array; mediaType: string } | null>
  getBannerReviewPreview(id: string, includeExclusive: boolean): Promise<{ bytes: Uint8Array; mediaType: 'image/png' } | null>
  listPendingBanners(includeExclusive: boolean): Promise<PendingBanner[]>
  moderateBanner(id: string, moderatorKey: Uint8Array, decision: 'approve' | 'reject' | 'suspend', operationId: string, includeExclusive: boolean): Promise<BannerModerationOutcome>
  listAdminPlacements():Promise<AdminPlacement[]>
  moderatePlacement(id:string,moderatorKey:Uint8Array,decision:'suspend'|'reactivate',operationId:string):Promise<PlacementModerationOutcome>
}

type PendingRow = { id: string; server_id: string; server_name: string; game_slug: string; banner_kind:'free'|'exclusive'; media_type: string; byte_size: number; width:number; height:number; frame_count: number; animation_duration_ms: number; alt_text: string; created_at: Date | string }
type OwnedServerRow = { id: string; name: string; game_slug: string; game_name: string }

export function createAdvertisingRepository(createClient: () => RankingQueryClient): AdvertisingRepository {
  const run = async <T>(operation: (client: RankingQueryClient) => Promise<T>) => {
    const client = createClient()
    try { await client.connect(); return await operation(client) } finally { await client.end() }
  }
  return {
    putExclusiveBanner: (id, owner, banner, altText) => run(async (client) => {
      const result = await client.query<{ put_exclusive_banner: string }>('SELECT api.put_exclusive_banner($1::uuid,$2::bytea,$3::bytea,$4::bytea,$5::bytea,$6::bytea,$7::varchar,$8,$9,$10,$11,$12::varchar) AS put_exclusive_banner', [id, owner, banner.bytes, banner.staticFallbackBytes, banner.originalSha256, banner.sanitizedSha256, banner.mediaType, banner.width, banner.height, banner.frameCount, banner.animationDurationMs, altText])
      const value=result.rows[0]?.put_exclusive_banner;if(value!=='stored'&&value!=='unavailable')throw new Error('Invalid banner outcome');return value
    }),
    listAdminPlacements:()=>run(async(client)=>{const result=await client.query<Record<string,string|number|null>>('SELECT id::text,server_name,website,game_slug,game_name,duration_days,status,starts_at::text,expires_at::text,queued_at::text,banner_status,claim_status,impression_count::text FROM api.list_admin_exclusive_placements()');return result.rows.map(row=>({id:String(row.id),serverName:String(row.server_name),website:String(row.website),gameSlug:String(row.game_slug),gameName:String(row.game_name),durationDays:Number(row.duration_days),status:row.status as AdminPlacement['status'],startsAt:row.starts_at?String(row.starts_at):null,expiresAt:row.expires_at?String(row.expires_at):null,queuedAt:String(row.queued_at),bannerStatus:String(row.banner_status),claimStatus:String(row.claim_status),impressionCount:Number(row.impression_count)}))}),
    moderatePlacement:(id,key,decision,operationId)=>run(async(client)=>{const result=await client.query<{moderate_exclusive_placement:string}>('SELECT api.moderate_exclusive_placement($1::uuid,$2::bytea,$3::varchar,$4::uuid) AS moderate_exclusive_placement',[id,key,decision,operationId]);const value=result.rows[0]?.moderate_exclusive_placement;if(['suspend','reactivate','expired','ineligible','inventory_full','invalid','unavailable'].includes(value))return value as PlacementModerationOutcome;throw new Error('Invalid placement moderation outcome')}),
    listPendingDonationClaims: () => run(async (client) => {
      const result = await client.query<Record<string, string|number|Date>>('SELECT id::text,server_name,game_name,website,donor_reference,duration_days,expected_amount_minor::text,currency,created_at FROM api.list_pending_donation_claims()')
      return result.rows.map((row) => ({ id:String(row.id),serverName:String(row.server_name),gameName:String(row.game_name),website:String(row.website),donorReference:String(row.donor_reference),durationDays:Number(row.duration_days),expectedAmountMinor:String(row.expected_amount_minor),currency:String(row.currency).trim(),createdAt:new Date(row.created_at).toISOString() }))
    }),
    moderateDonationClaim: (id, moderatorKey, decision, reasonCode, operationId) => run(async (client) => {
      const result=await client.query<{ moderate_donation_claim:string }>('SELECT api.moderate_donation_claim($1::uuid,$2::bytea,$3::varchar,$4::varchar,$5::uuid) AS moderate_donation_claim',[id,moderatorKey,decision,reasonCode,operationId])
      const outcome=result.rows[0]?.moderate_donation_claim
      if(outcome==='verified'||outcome==='rejected'||outcome==='invalid'||outcome==='unavailable') return outcome
      throw new Error('Invalid donation moderation outcome')
    }),
    submitDonationClaim: (ownerKey, serverId, packageCode, donorReference) => run(async (client) => {
      const result = await client.query<{ outcome:string; claim_id:string|null }>('SELECT outcome,claim_id::text FROM api.submit_donation_claim($1::bytea,$2::uuid,$3::varchar,$4::varchar)', [ownerKey,serverId,packageCode,donorReference])
      const row=result.rows[0]
      if (row?.outcome==='accepted' && row.claim_id) return { outcome:'accepted',claimId:row.claim_id }
      if (row?.outcome==='invalid'||row?.outcome==='unavailable'||row?.outcome==='limit_reached'||row?.outcome==='duplicate') return { outcome:row.outcome }
      throw new Error('Invalid claim outcome')
    }),
    listOwnedServers: (ownerKey) => run(async (client) => {
      const result = await client.query<OwnedServerRow>('SELECT id::text,name,game_slug,game_name FROM api.list_owned_servers($1::bytea)', [ownerKey])
      return result.rows.map((row) => ({ id: row.id, name: row.name, gameSlug: row.game_slug, gameName: row.game_name }))
    }),
    listExclusiveEligibleServers: (ownerKey) => run(async (client) => {
      const result = await client.query<OwnedServerRow>('SELECT id::text,name,game_slug,game_name FROM api.list_exclusive_banner_eligible_servers($1::bytea)', [ownerKey])
      return result.rows.map((row) => ({ id: row.id, name: row.name, gameSlug: row.game_slug, gameName: row.game_name }))
    }),
    listActivePackages:()=>run(async(client)=>{const result=await client.query<Record<string,string|number>>('SELECT code,duration_days,tier,price_minor::text,currency FROM api.list_active_ad_packages()');return result.rows.map(row=>({code:String(row.code),durationDays:Number(row.duration_days) as 7|30,tier:String(row.tier),priceMinor:String(row.price_minor),currency:String(row.currency).trim()}))}),
    listOwnerDonationClaims:(ownerKey)=>run(async(client)=>{const result=await client.query<Record<string,string|number|Date|null>>('SELECT id::text,server_name,game_name,duration_days,status,created_at,rejection_reason FROM api.list_owner_donation_claims($1::bytea)',[ownerKey]);return result.rows.map(row=>({id:String(row.id),serverName:String(row.server_name),gameName:String(row.game_name),durationDays:Number(row.duration_days),status:row.status as OwnerDonationClaim['status'],createdAt:new Date(row.created_at as string|Date).toISOString(),...(row.rejection_reason?{rejectionReason:String(row.rejection_reason)}:{})}))}),
    putBanner: (id, owner, banner, altText) => run(async (client) => {
      const result = await client.query<{ put_server_banner: string }>('SELECT api.put_server_banner($1::uuid,$2::bytea,$3::bytea,$4::bytea,$5::bytea,$6::bytea,$7::varchar,$8,$9,$10,$11,$12::varchar) AS put_server_banner', [id, owner, banner.bytes, banner.staticFallbackBytes, banner.originalSha256, banner.sanitizedSha256, banner.mediaType, banner.width, banner.height, banner.frameCount, banner.animationDurationMs, altText])
      const value = result.rows[0]?.put_server_banner
      if (value !== 'stored' && value !== 'unavailable') throw new Error('Invalid banner outcome')
      return value
    }),
    listPublic: (slug) => run(async (client) => {
      await client.query('SELECT api.reconcile_exclusive_game($1::varchar)',[slug])
      const result = await client.query<Record<string, string>>('SELECT id::text,server_id::text,server_name,banner_id::text,media_type,alt_text,destination_url,starts_at::text,expires_at::text FROM api.public_exclusive_ads WHERE game_slug=$1 ORDER BY starts_at,id', [slug])
      return result.rows.map((row) => ({ id: row.id, serverId: row.server_id, serverName: row.server_name, bannerId: row.banner_id, mediaType: row.media_type, altText: row.alt_text, destinationUrl: row.destination_url, startsAt: new Date(row.starts_at).toISOString(), expiresAt: new Date(row.expires_at).toISOString() }))
    }),
    recordImpression:(placementId)=>run(async(client)=>{const result=await client.query<{record_exclusive_impression:string}>('SELECT api.record_exclusive_impression($1::uuid) AS record_exclusive_impression',[placementId]);const value=result.rows[0]?.record_exclusive_impression;if(value==='recorded'||value==='unavailable')return value;throw new Error('Invalid impression outcome')}),
    getPublicBanner: (id, staticFallback) => run(async (client) => {
      const result = await client.query<{ content: Uint8Array; media_type: string }>('SELECT content,media_type FROM api.get_public_banner($1::uuid,$2::boolean)', [id, staticFallback])
      const row = result.rows[0]
      return row ? { bytes: row.content, mediaType: row.media_type } : null
    }),
    getBannerReviewPreview: (id, includeExclusive) => run(async (client) => {
      const result = await client.query<{ content: Uint8Array; media_type: 'image/png' }>('SELECT content,media_type FROM api.get_banner_review_preview($1::uuid,$2::boolean)', [id, includeExclusive])
      const row = result.rows[0]
      return row ? { bytes: row.content, mediaType: row.media_type } : null
    }),
    listPendingBanners: (includeExclusive) => run(async (client) => {
      const result = await client.query<PendingRow>('SELECT * FROM api.list_pending_banners($1::boolean)', [includeExclusive])
      return result.rows.map((row) => ({ id: row.id, serverId: row.server_id, serverName: row.server_name, gameSlug: row.game_slug, bannerKind:row.banner_kind, mediaType: row.media_type, byteSize: row.byte_size, width:row.width, height:row.height, frameCount: row.frame_count, animationDurationMs: row.animation_duration_ms, altText: row.alt_text, createdAt: new Date(row.created_at).toISOString() }))
    }),
    moderateBanner: (id, moderatorKey, decision, operationId, includeExclusive) => run(async (client) => {
      const result = await client.query<{ moderate_banner: string }>('SELECT api.moderate_banner($1::uuid,$2::bytea,$3::varchar,$4::uuid,$5::boolean) AS moderate_banner', [id, moderatorKey, decision, operationId, includeExclusive])
      const value = result.rows[0]?.moderate_banner
      if (value !== 'approved' && value !== 'rejected' && value !== 'suspended' && value !== 'unavailable') throw new Error('Invalid banner moderation outcome')
      return value
    }),
  }
}

export const createHyperdriveAdvertisingRepository = (url: string) => createAdvertisingRepository(() => new Client({ connectionString: url }))
