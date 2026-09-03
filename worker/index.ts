import { parseGameSlug } from './contracts/rankings'
import { createFirebaseVerifier } from './auth'
import { createHyperdriveRankingRepository, type RankingRepository } from './db/rankingRepository'
import { createHyperdriveVoteRepository } from './db/voteRepository'
import { createTurnstileVerifier } from './turnstile'
import { createVoteEndpoint } from './voteEndpoint'
import { deriveVoterKey } from './voterKey'
import { createHyperdriveSubmissionRepository } from './db/submissionRepository'
import { deriveOwnerKey } from './ownerKey'
import { createSubmissionEndpoint } from './submissionEndpoint'
import { createAdminVerifier } from './adminAuth'
import { createHyperdriveModerationRepository } from './db/moderationRepository'
import { createModerationEndpoints } from './moderationEndpoints'
import { deriveModeratorKey } from './moderatorKey'
import { createAdvertisingEndpoints } from './advertisingEndpoints'
import { createHyperdriveAdvertisingRepository } from './db/advertisingRepository'

type GeneratedBindings = Pick<Env,'HYPERDRIVE'|'RANKINGS_RATE_LIMITER'|'VOTE_RATE_LIMITER'|'SUBMISSION_RATE_LIMITER'|'ADMIN_RATE_LIMITER'|'ADVERTISING_RATE_LIMITER'>
type WorkerEnv = GeneratedBindings & {
  ALLOWED_ORIGIN: string
  FIREBASE_PROJECT_ID: string
  TURNSTILE_HOSTNAME: string
  TURNSTILE_ACTION: string
  SUBMISSION_TURNSTILE_ACTION: string
  BANNER_TURNSTILE_ACTION: string
  VOTING_ENABLED: string
  SUBMISSIONS_ENABLED: string
  ADMIN_ENABLED: string
  BANNER_UPLOADS_ENABLED: string
  EXCLUSIVE_ADS_ENABLED: string
  BANNER_MODERATION_ENABLED: string
  DONATION_CLAIMS_ENABLED: string
  DONATION_TURNSTILE_ACTION: string
  TURNSTILE_SECRET: string
  VOTER_HMAC_SECRET: string
  OWNER_HMAC_SECRET: string
  MODERATOR_HMAC_SECRET: string
}
type RepositoryFactory = (env: WorkerEnv) => RankingRepository
type VoteHandler = (request: Request, serverId: string) => Promise<Response>
type VoteHandlerFactory = (env: WorkerEnv) => VoteHandler
type SubmissionHandler = (request: Request) => Promise<Response>
type SubmissionHandlerFactory = (env: WorkerEnv) => SubmissionHandler
type ModerationFactory = (env: WorkerEnv) => ReturnType<typeof createModerationEndpoints>
type AdvertisingFactory = (env: WorkerEnv) => ReturnType<typeof createAdvertisingEndpoints>

export function createWorker(repositoryFactory: RepositoryFactory, voteHandlerFactory?: VoteHandlerFactory, submissionHandlerFactory?: SubmissionHandlerFactory, moderationFactory?: ModerationFactory, advertisingFactory?: AdvertisingFactory) {
  return {
    async fetch(request, env): Promise<Response> {
      try {
        const url = new URL(request.url)
        const voteMatch = url.pathname.match(/^\/api\/servers\/([^/]+)\/votes$/)
        const isSubmission = url.pathname === '/api/server-submissions'
        const adminList = url.pathname === '/api/admin/server-submissions'
        const adminDecision = url.pathname.match(/^\/api\/admin\/server-submissions\/([^/]+)\/decision$/)
        const bannerUpload = url.pathname.match(/^\/api\/advertising\/servers\/([^/]+)\/banner$/)
        const ownerBannerWorkspace = url.pathname === '/api/advertising/owner-workspace'
        const publicAds = url.pathname.match(/^\/api\/games\/([^/]+)\/exclusive-servers$/)
        const publicBanner = url.pathname.match(/^\/api\/advertising\/banners\/([^/]+)$/)
        const adminBannerList = url.pathname === '/api/admin/banners'
        const adminBannerPreview = url.pathname.match(/^\/api\/admin\/banners\/([^/]+)\/preview$/)
        const adminBannerDecision = url.pathname.match(/^\/api\/admin\/banners\/([^/]+)\/decision$/)
        const donationClaim = url.pathname === '/api/advertising/claims'
        if (request.method === 'OPTIONS') {
          const writeRoute = voteMatch || isSubmission || adminDecision || bannerUpload || adminBannerDecision || donationClaim
          const protectedRoute = voteMatch || isSubmission || adminList || adminDecision || bannerUpload || ownerBannerWorkspace || adminBannerList || adminBannerPreview || adminBannerDecision || donationClaim
          return corsResponse(request, env, new Response(null, { status: 204 }), writeRoute ? `${bannerUpload ? 'PUT' : 'POST'}, OPTIONS` : 'GET, OPTIONS', protectedRoute ? `authorization, content-type${bannerUpload ? ', x-banner-alt-text, x-turnstile-token' : ''}` : undefined)
        }
        if (url.pathname === '/api/health' && request.method === 'GET') return corsResponse(request, env, Response.json({ ok: true }, { headers: noStoreHeaders() }))
        if (url.pathname === '/api/servers') {
          if (request.method !== 'GET') return corsResponse(request, env, methodNotAllowed())
          const clientKey = request.headers.get('cf-connecting-ip') ?? 'unknown-client'
          const rateLimit = await env.RANKINGS_RATE_LIMITER.limit({ key: `${clientKey}:approved-servers` })
          if (!rateLimit.success) return corsResponse(request, env, rateLimited())
          const servers = await repositoryFactory(env).listApprovedServers()
          return corsResponse(request, env, Response.json({ ok: true, servers }, { headers: noStoreHeaders() }))
        }
        if (voteMatch) {
          if (request.method !== 'POST') return corsResponse(request, env, methodNotAllowed('POST'), 'POST, OPTIONS', 'authorization, content-type')
          if (!isAllowedOrigin(request, env)) return jsonError('This request is not allowed.', 403)
          if (env.VOTING_ENABLED !== 'true' || !voteHandlerFactory) return corsResponse(request, env, jsonError('Voting is not available yet.', 503), 'POST, OPTIONS', 'authorization, content-type')
          const response = await voteHandlerFactory(env)(request, safeDecode(voteMatch[1]))
          return corsResponse(request, env, response, 'POST, OPTIONS', 'authorization, content-type')
        }
        if (isSubmission) {
          if (request.method !== 'POST') return corsResponse(request, env, methodNotAllowed('POST'), 'POST, OPTIONS', 'authorization, content-type')
          if (!isAllowedOrigin(request, env)) return jsonError('This request is not allowed.', 403)
          if (env.SUBMISSIONS_ENABLED !== 'true' || !submissionHandlerFactory) return corsResponse(request, env, jsonError('Submissions are not available yet.', 503), 'POST, OPTIONS', 'authorization, content-type')
          return corsResponse(request, env, await submissionHandlerFactory(env)(request), 'POST, OPTIONS', 'authorization, content-type')
        }
        if (adminList || adminDecision) {
          if (env.ADMIN_ENABLED !== 'true' || !moderationFactory) return corsResponse(request, env, jsonError('Moderation is not available yet.', 503), adminDecision ? 'POST, OPTIONS' : 'GET, OPTIONS', 'authorization, content-type')
          const moderation = moderationFactory(env)
          const response = adminDecision ? await moderation.decide(request, safeDecode(adminDecision[1])) : await moderation.list(request)
          return corsResponse(request, env, response, adminDecision ? 'POST, OPTIONS' : 'GET, OPTIONS', 'authorization, content-type')
        }
        if (bannerUpload) {
          if (request.method !== 'PUT') return corsResponse(request, env, methodNotAllowed('PUT'), 'PUT, OPTIONS', 'authorization, content-type, x-banner-alt-text, x-turnstile-token')
          if (!isAllowedOrigin(request, env)) return jsonError('This request is not allowed.', 403)
          if (env.BANNER_UPLOADS_ENABLED !== 'true' || !advertisingFactory) return corsResponse(request, env, jsonError('Banner uploads are not available yet.', 503), 'PUT, OPTIONS', 'authorization, content-type, x-banner-alt-text, x-turnstile-token')
          return corsResponse(request, env, await advertisingFactory(env).upload(request, safeDecode(bannerUpload[1])), 'PUT, OPTIONS', 'authorization, content-type, x-banner-alt-text, x-turnstile-token')
        }
        if (ownerBannerWorkspace) {
          if (request.method !== 'GET') return corsResponse(request, env, methodNotAllowed(), 'GET, OPTIONS', 'authorization, content-type')
          if (env.BANNER_UPLOADS_ENABLED !== 'true' || !advertisingFactory) return corsResponse(request, env, jsonError('Banner uploads are not available yet.', 503), 'GET, OPTIONS', 'authorization, content-type')
          return corsResponse(request, env, await advertisingFactory(env).ownerWorkspace(request), 'GET, OPTIONS', 'authorization, content-type')
        }
        if (adminBannerList || adminBannerPreview || adminBannerDecision) {
          const methods = adminBannerDecision ? 'POST, OPTIONS' : 'GET, OPTIONS'
          if (env.BANNER_MODERATION_ENABLED !== 'true' || !advertisingFactory) return corsResponse(request, env, jsonError('Banner moderation is not available yet.', 503), methods, 'authorization, content-type')
          const advertising = advertisingFactory(env)
          const response = adminBannerDecision ? await advertising.moderate(request, safeDecode(adminBannerDecision[1])) : adminBannerPreview ? await advertising.previewPending(request, safeDecode(adminBannerPreview[1])) : await advertising.listPending(request)
          return corsResponse(request, env, response, methods, 'authorization, content-type')
        }
        if (publicAds) {
          if (request.method !== 'GET') return corsResponse(request, env, methodNotAllowed())
          if (env.EXCLUSIVE_ADS_ENABLED !== 'true' || !advertisingFactory) return corsResponse(request, env, jsonError('Exclusive servers are not available yet.', 503))
          const gameSlug = parseGameSlug(safeDecode(publicAds[1]))
          if (!gameSlug) return corsResponse(request, env, jsonError('Please choose a valid game.', 400))
          const clientKey = request.headers.get('cf-connecting-ip') ?? 'unknown-client'
          if (!(await env.ADVERTISING_RATE_LIMITER.limit({ key: `${clientKey}:exclusive:${gameSlug}` })).success) return corsResponse(request, env, rateLimited())
          return corsResponse(request, env, await advertisingFactory(env).listPublic(request, gameSlug))
        }
        if (publicBanner) {
          if (request.method !== 'GET') return corsResponse(request, env, methodNotAllowed())
          if (env.EXCLUSIVE_ADS_ENABLED !== 'true' || !advertisingFactory) return corsResponse(request, env, jsonError('Banner not found.', 404))
          const clientKey = request.headers.get('cf-connecting-ip') ?? 'unknown-client'
          if (!(await env.ADVERTISING_RATE_LIMITER.limit({ key: `${clientKey}:banner` })).success) return corsResponse(request, env, rateLimited())
          return corsResponse(request, env, await advertisingFactory(env).banner(request, safeDecode(publicBanner[1])))
        }
        const rankingMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/rankings$/)
        if (rankingMatch) {
          if (request.method !== 'GET') return corsResponse(request, env, methodNotAllowed())
          const gameSlug = parseGameSlug(safeDecode(rankingMatch[1]))
          if (!gameSlug) return corsResponse(request, env, jsonError('Please choose a valid game.', 400))
          const clientKey = request.headers.get('cf-connecting-ip') ?? 'unknown-client'
          const rateLimit = await env.RANKINGS_RATE_LIMITER.limit({ key: `${clientKey}:${gameSlug}` })
          if (!rateLimit.success) return corsResponse(request, env, rateLimited())
          const rankings = await repositoryFactory(env).findByGameSlug(gameSlug)
          if (!rankings) return corsResponse(request, env, jsonError('This game is not available.', 404))
          return corsResponse(request, env, Response.json({ ok: true, ...rankings }, { headers: noStoreHeaders() }))
        }
        if (donationClaim) {
          if (request.method!=='POST') return corsResponse(request,env,methodNotAllowed('POST'),'POST, OPTIONS','authorization, content-type')
          if(env.DONATION_CLAIMS_ENABLED!=='true'||!advertisingFactory) return corsResponse(request,env,jsonError('Donation claims are not available yet.',503),'POST, OPTIONS','authorization, content-type')
          return corsResponse(request,env,await advertisingFactory(env).submitClaim(request),'POST, OPTIONS','authorization, content-type')
        }
        return corsResponse(request, env, jsonError('Not found.', 404))
      } catch (error) {
        console.error(JSON.stringify({ event: 'request_failed', error: error instanceof Error ? error.name : 'unknown' }))
        return corsResponse(request, env, jsonError('The request could not be completed.', 500))
      }
    },
  } satisfies ExportedHandler<WorkerEnv>
}

export default createWorker(
  (env) => createHyperdriveRankingRepository(env.HYPERDRIVE.connectionString),
  (env) => {
    const firebase = createFirebaseVerifier({ projectId: env.FIREBASE_PROJECT_ID })
    return createVoteEndpoint({
      verifyFirebase: (request) => firebase.verify(request),
      verifyTurnstile: createTurnstileVerifier(env.TURNSTILE_SECRET, env.TURNSTILE_HOSTNAME, env.TURNSTILE_ACTION),
      deriveVoterKey: (uid) => deriveVoterKey(env.VOTER_HMAC_SECRET, uid),
      repository: createHyperdriveVoteRepository(env.HYPERDRIVE.connectionString),
      rateLimit: (key) => env.VOTE_RATE_LIMITER.limit({ key }),
    })
  },
  (env) => {
    const firebase = createFirebaseVerifier({ projectId: env.FIREBASE_PROJECT_ID })
    return createSubmissionEndpoint({
      verifyFirebase: (request) => firebase.verify(request),
      verifyTurnstile: createTurnstileVerifier(env.TURNSTILE_SECRET, env.TURNSTILE_HOSTNAME, env.SUBMISSION_TURNSTILE_ACTION),
      deriveOwnerKey: (uid) => deriveOwnerKey(env.OWNER_HMAC_SECRET, uid),
      repository: createHyperdriveSubmissionRepository(env.HYPERDRIVE.connectionString),
      rateLimit: (key) => env.SUBMISSION_RATE_LIMITER.limit({ key }),
    })
  },
  (env) => createModerationEndpoints({
    allowedOrigins: env.ALLOWED_ORIGIN.split(','),
    verifyAdmin: createAdminVerifier(env.FIREBASE_PROJECT_ID),
    deriveModeratorKey: (uid) => deriveModeratorKey(env.MODERATOR_HMAC_SECRET, uid),
    repository: createHyperdriveModerationRepository(env.HYPERDRIVE.connectionString),
    rateLimit: (key) => env.ADMIN_RATE_LIMITER.limit({ key }),
  }),
  (env) => {
    const firebase = createFirebaseVerifier({ projectId: env.FIREBASE_PROJECT_ID })
    return createAdvertisingEndpoints({
      allowedOrigins: env.ALLOWED_ORIGIN.split(','),
      verifyOwner: (request) => firebase.verify(request),
      verifyTurnstile: createTurnstileVerifier(env.TURNSTILE_SECRET, env.TURNSTILE_HOSTNAME, env.BANNER_TURNSTILE_ACTION),
      verifyDonationTurnstile: createTurnstileVerifier(env.TURNSTILE_SECRET, env.TURNSTILE_HOSTNAME, env.DONATION_TURNSTILE_ACTION),
      verifyAdmin: createAdminVerifier(env.FIREBASE_PROJECT_ID),
      deriveOwnerKey: (uid) => deriveOwnerKey(env.OWNER_HMAC_SECRET, uid),
      deriveModeratorKey: (uid) => deriveModeratorKey(env.MODERATOR_HMAC_SECRET, uid),
      rateLimit: (key) => env.ADVERTISING_RATE_LIMITER.limit({ key }),
      repository: createHyperdriveAdvertisingRepository(env.HYPERDRIVE.connectionString),
    })
  },
)

function noStoreHeaders() { return { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } }
function jsonError(message: string, status: number) { return Response.json({ ok: false, message }, { status, headers: noStoreHeaders() }) }
function methodNotAllowed(allow = 'GET') { return Response.json({ ok: false, message: 'Method not allowed.' }, { status: 405, headers: { ...noStoreHeaders(), allow } }) }
function rateLimited() { return Response.json({ ok: false, message: 'Too many requests. Please try again shortly.' }, { status: 429, headers: { ...noStoreHeaders(), 'retry-after': '60' } }) }
function isAllowedOrigin(request: Request, env: WorkerEnv) { const origin = request.headers.get('origin'); return Boolean(origin && env.ALLOWED_ORIGIN.split(',').includes(origin)) }
function corsResponse(request: Request, env: WorkerEnv, response: Response, methods = 'GET, OPTIONS', headers = 'authorization, content-type, x-firebase-appcheck') { const origin = request.headers.get('origin'); if (origin && env.ALLOWED_ORIGIN.split(',').includes(origin)) { response.headers.set('access-control-allow-origin', origin); response.headers.set('access-control-allow-headers', headers); response.headers.set('access-control-allow-methods', methods); response.headers.set('vary', 'Origin') } return response }
function safeDecode(value: string) { try { return decodeURIComponent(value) } catch { return '' } }
