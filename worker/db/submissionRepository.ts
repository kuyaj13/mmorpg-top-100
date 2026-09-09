import { Client } from 'pg'
import type { RankingQueryClient } from './rankingRepository'
import type { SanitizedBanner } from '../bannerValidation'

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
  banner?: { image: SanitizedBanner; altText: string }
}
export type SubmissionOutcome = { outcome: 'accepted'; submissionId: string } | { outcome: 'duplicate' | 'game_unavailable' | 'limit_reached' | 'invalid_banner' }
export type SubmissionRepository = { submit(input: NewServerSubmission): Promise<SubmissionOutcome> }
type SubmissionRow = { outcome: string; submission_id: string | null }

export function createSubmissionRepository(createClient: () => RankingQueryClient): SubmissionRepository {
  return {
    async submit(input) {
      const client = createClient()
      try {
        await client.connect()
        await client.query('BEGIN')
        const result = await client.query<SubmissionRow>(
          `SELECT outcome, submission_id::text AS submission_id
             FROM api.submit_server($1::bytea, $2::varchar, $3::varchar, $4::text,
                                    $5::varchar, $6::varchar, $7::varchar, $8::varchar, $9::varchar)`,
          [input.ownerKey, input.gameSlug, input.name, input.website, input.websiteHost, input.gameVersion, input.region, input.mode, input.description],
        )
        const row = result.rows[0]
        if (row?.outcome === 'accepted' && row.submission_id) {
          if (input.banner) {
            const banner = input.banner.image
            let stored
            try {
              stored = await client.query<{ put_submission_banner: string }>(
                `SELECT api.put_submission_banner($1::uuid, $2::bytea, $3::bytea, $4::bytea,
                                                      $5::bytea, $6::bytea, $7::varchar, $8::integer,
                                                      $9::integer, $10::integer, $11::integer, $12::varchar)
                          AS put_submission_banner`,
                [row.submission_id, input.ownerKey, banner.bytes, banner.staticFallbackBytes, banner.originalSha256,
                  banner.sanitizedSha256, banner.mediaType, banner.width, banner.height, banner.frameCount,
                  banner.animationDurationMs, input.banner.altText],
              )
            } catch (error) {
              if (isCheckViolation(error)) {
                await client.query('ROLLBACK')
                return { outcome: 'invalid_banner' }
              }
              throw error
            }
            if (stored.rows[0]?.put_submission_banner !== 'stored') throw new Error('Banner was not stored')
          }
          await client.query('COMMIT')
          return { outcome: 'accepted', submissionId: row.submission_id }
        }
        if (row?.outcome === 'duplicate' || row?.outcome === 'game_unavailable' || row?.outcome === 'limit_reached') {
          await client.query('ROLLBACK')
          return { outcome: row.outcome }
        }
        throw new Error('Invalid submission outcome')
      } catch (error) {
        try { await client.query('ROLLBACK') } catch { /* connection may already be unavailable */ }
        throw error
      } finally {
        await client.end()
      }
    },
  }
}

function isCheckViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23514')
}

export function createHyperdriveSubmissionRepository(connectionString: string): SubmissionRepository {
  return createSubmissionRepository(() => new Client({ connectionString }))
}
