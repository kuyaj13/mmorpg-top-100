import { Client } from 'pg'
import type { SanitizedBanner } from '../bannerValidation'
import type { RankingQueryClient } from './rankingRepository'

export type PublicAd = { id: string; serverId: string; serverName: string; bannerId: string; mediaType: string; altText: string; destinationUrl: string; startsAt: string; expiresAt: string }
export type PendingBanner = { id: string; serverId: string; serverName: string; gameSlug: string; mediaType: string; byteSize: number; frameCount: number; animationDurationMs: number; altText: string; createdAt: string }
export type BannerModerationOutcome = 'approved' | 'rejected' | 'suspended' | 'unavailable'
export type AdvertisingRepository = {
  putBanner(serverId: string, ownerKey: Uint8Array, banner: SanitizedBanner, altText: string): Promise<'stored' | 'unavailable'>
  listPublic(gameSlug: string): Promise<PublicAd[]>
  getPublicBanner(id: string, staticFallback: boolean): Promise<{ bytes: Uint8Array; mediaType: string } | null>
  listPendingBanners(): Promise<PendingBanner[]>
  moderateBanner(id: string, moderatorKey: Uint8Array, decision: 'approve' | 'reject' | 'suspend', operationId: string): Promise<BannerModerationOutcome>
}

type PendingRow = { id: string; server_id: string; server_name: string; game_slug: string; media_type: string; byte_size: number; frame_count: number; animation_duration_ms: number; alt_text: string; created_at: Date | string }

export function createAdvertisingRepository(createClient: () => RankingQueryClient): AdvertisingRepository {
  const run = async <T>(operation: (client: RankingQueryClient) => Promise<T>) => {
    const client = createClient()
    try { await client.connect(); return await operation(client) } finally { await client.end() }
  }
  return {
    putBanner: (id, owner, banner, altText) => run(async (client) => {
      const result = await client.query<{ put_server_banner: string }>('SELECT api.put_server_banner($1::uuid,$2::bytea,$3::bytea,$4::bytea,$5::bytea,$6::bytea,$7::varchar,$8,$9,$10,$11,$12::varchar) AS put_server_banner', [id, owner, banner.bytes, banner.staticFallbackBytes, banner.originalSha256, banner.sanitizedSha256, banner.mediaType, banner.width, banner.height, banner.frameCount, banner.animationDurationMs, altText])
      const value = result.rows[0]?.put_server_banner
      if (value !== 'stored' && value !== 'unavailable') throw new Error('Invalid banner outcome')
      return value
    }),
    listPublic: (slug) => run(async (client) => {
      const result = await client.query<Record<string, string>>('SELECT id::text,server_id::text,server_name,banner_id::text,media_type,alt_text,destination_url,starts_at::text,expires_at::text FROM api.public_exclusive_ads WHERE game_slug=$1 ORDER BY starts_at,id', [slug])
      return result.rows.map((row) => ({ id: row.id, serverId: row.server_id, serverName: row.server_name, bannerId: row.banner_id, mediaType: row.media_type, altText: row.alt_text, destinationUrl: row.destination_url, startsAt: row.starts_at, expiresAt: row.expires_at }))
    }),
    getPublicBanner: (id, staticFallback) => run(async (client) => {
      const result = await client.query<{ content: Uint8Array; media_type: string }>('SELECT content,media_type FROM api.get_public_banner($1::uuid,$2::boolean)', [id, staticFallback])
      const row = result.rows[0]
      return row ? { bytes: row.content, mediaType: row.media_type } : null
    }),
    listPendingBanners: () => run(async (client) => {
      const result = await client.query<PendingRow>('SELECT * FROM api.list_pending_banners()')
      return result.rows.map((row) => ({ id: row.id, serverId: row.server_id, serverName: row.server_name, gameSlug: row.game_slug, mediaType: row.media_type, byteSize: row.byte_size, frameCount: row.frame_count, animationDurationMs: row.animation_duration_ms, altText: row.alt_text, createdAt: new Date(row.created_at).toISOString() }))
    }),
    moderateBanner: (id, moderatorKey, decision, operationId) => run(async (client) => {
      const result = await client.query<{ moderate_banner: string }>('SELECT api.moderate_banner($1::uuid,$2::bytea,$3::varchar,$4::uuid) AS moderate_banner', [id, moderatorKey, decision, operationId])
      const value = result.rows[0]?.moderate_banner
      if (value !== 'approved' && value !== 'rejected' && value !== 'suspended' && value !== 'unavailable') throw new Error('Invalid banner moderation outcome')
      return value
    }),
  }
}

export const createHyperdriveAdvertisingRepository = (url: string) => createAdvertisingRepository(() => new Client({ connectionString: url }))
