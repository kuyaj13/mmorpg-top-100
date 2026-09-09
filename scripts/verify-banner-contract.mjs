import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), 'utf8')
const worker = read('worker/bannerValidation.ts')
const migration = read('drizzle/0016_free_banner_45_frame_limit.sql')
const placementActivationMigration = read('drizzle/0018_activate_placement_after_exclusive_banner_approval.sql')
const bannerDeliveryMigration = read('drizzle/0019_scope_exclusive_banner_delivery.sql')
const submission = read('src/submission/SubmissionPage.tsx')
const upload = read('src/advertising/BannerUploadForm.tsx')
const review = read('src/admin/bannerReviewApiService.ts')

const failures = []
const requireMatch = (source, pattern, message) => {
  if (!pattern.test(source)) failures.push(message)
}

requireMatch(worker, /bannerLimits=\{[^\r\n]*width:468,height:60,maxFrames:45,maxDurationMs:15_000/, 'The Worker free-banner policy must remain 468 by 60 pixels, 45 frames, and 15 seconds.')
requireMatch(worker, /exclusiveBannerLimits=\{[^\r\n]*width:936,height:120,maxFrames:15,maxDurationMs:15_000/, 'The Worker exclusive-banner policy must remain 936 by 120 pixels, 15 frames, and 15 seconds.')
requireMatch(migration, /banner_kind\s*=\s*'free'\s+AND\s+frame_count\s*<=\s*45/i, 'The database free-banner constraint must allow 45 frames.')
requireMatch(migration, /banner_kind\s*=\s*'exclusive'\s+AND\s+frame_count\s*<=\s*15/i, 'The database exclusive-banner constraint must allow 15 frames.')
requireMatch(migration, /frame_count\s+BETWEEN\s+1\s+AND\s+45\s+AND\s+animation_duration_ms\s+BETWEEN\s+0\s+AND\s+15000/i, 'The database submission-banner constraint must allow 45 frames and 15 seconds.')
requireMatch(submission, /gifFrameLimitError\(banner,\s*45\)/, 'The submission form must enforce the 45-frame limit before upload.')
requireMatch(submission, /up to \{?45\}? frames and run for up to 15 seconds/, 'The submission form must disclose the 45-frame and 15-second limits.')
requireMatch(upload, /gifFrameLimitError\(file,\s*exclusive\s*\?\s*15\s*:\s*45\)/, 'The owner upload form must enforce the free and exclusive frame limits.')
requireMatch(review, /isIntegerBetween\(item\.frameCount,\s*1,\s*item\.bannerKind\s*===\s*'exclusive'\s*\?\s*15\s*:\s*45\)/, 'The administrator response validator must enforce the same frame limits.')
requireMatch(placementActivationMigration, /CREATE OR REPLACE FUNCTION api\.moderate_banner\(uuid,bytea,varchar,uuid,boolean\)/i, 'Scoped banner moderation must be replaced by the placement activation migration.')
requireMatch(placementActivationMigration, /requested\s*=\s*'approved'[\s\S]*PERFORM api\.reconcile_exclusive_game\(approved_game_slug\)/i, 'Approving an Exclusive banner must reconcile its placement in the same transaction.')
requireMatch(placementActivationMigration, /d\.status\s*=\s*'verified'[\s\S]*b\.moderation_status\s*=\s*'approved'[\s\S]*NOT EXISTS[\s\S]*api\.reconcile_exclusive_game\(eligible_game\)/i, 'The migration must reconcile existing eligible claims without duplicating placements.')
requireMatch(bannerDeliveryMigration, /b\.banner_kind\s*=\s*'free'[\s\S]*b\.banner_kind\s*=\s*'exclusive'[\s\S]*EXISTS\s*\(SELECT 1 FROM api\.public_exclusive_ads ad WHERE ad\.banner_id=b\.id\)/i, 'Public Exclusive banner bytes must remain scoped to an eligible active placement.')

if (failures.length) {
  for (const failure of failures) console.error(`Banner contract mismatch: ${failure}`)
  process.exit(1)
}

console.info('Banner contract verification passed across Worker, forms, moderation, and database migration.')
