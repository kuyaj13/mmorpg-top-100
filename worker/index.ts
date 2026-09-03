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

type WorkerEnv = {
  ALLOWED_ORIGIN: string
  HYPERDRIVE: Hyperdrive
  RANKINGS_RATE_LIMITER: RateLimit
  VOTE_RATE_LIMITER: RateLimit
  VOTING_ENABLED: string
  SUBMISSIONS_ENABLED: string
  FIREBASE_PROJECT_ID: string
  TURNSTILE_SECRET: string
  TURNSTILE_HOSTNAME: string
  TURNSTILE_ACTION: string
  SUBMISSION_TURNSTILE_ACTION: string
  VOTER_HMAC_SECRET: string
  OWNER_HMAC_SECRET: string
  SUBMISSION_RATE_LIMITER: RateLimit
}
type RepositoryFactory = (env: WorkerEnv) => RankingRepository
type VoteHandler = (request: Request, serverId: string) => Promise<Response>
type VoteHandlerFactory = (env: WorkerEnv) => VoteHandler
type SubmissionHandler = (request: Request) => Promise<Response>
type SubmissionHandlerFactory = (env: WorkerEnv) => SubmissionHandler

export function createWorker(repositoryFactory: RepositoryFactory, voteHandlerFactory?: VoteHandlerFactory, submissionHandlerFactory?: SubmissionHandlerFactory) {
  return {
    async fetch(request, env): Promise<Response> {
      try {
        const url = new URL(request.url)
        const voteMatch = url.pathname.match(/^\/api\/servers\/([^/]+)\/votes$/)
        const isSubmission = url.pathname === '/api/server-submissions'
        if (request.method === 'OPTIONS') return corsResponse(request, env, new Response(null, { status: 204 }), voteMatch || isSubmission ? 'POST, OPTIONS' : 'GET, OPTIONS', voteMatch || isSubmission ? 'authorization, content-type' : undefined)
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
        if (url.pathname === '/api/advertising/claims' && request.method === 'POST') return corsResponse(request, env, jsonError('Donation claims are not available yet.', 503))
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
)

function noStoreHeaders() { return { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } }
function jsonError(message: string, status: number) { return Response.json({ ok: false, message }, { status, headers: noStoreHeaders() }) }
function methodNotAllowed(allow = 'GET') { return Response.json({ ok: false, message: 'Method not allowed.' }, { status: 405, headers: { ...noStoreHeaders(), allow } }) }
function rateLimited() { return Response.json({ ok: false, message: 'Too many requests. Please try again shortly.' }, { status: 429, headers: { ...noStoreHeaders(), 'retry-after': '60' } }) }
function isAllowedOrigin(request: Request, env: WorkerEnv) { const origin = request.headers.get('origin'); return Boolean(origin && env.ALLOWED_ORIGIN.split(',').includes(origin)) }
function corsResponse(request: Request, env: WorkerEnv, response: Response, methods = 'GET, OPTIONS', headers = 'authorization, content-type, x-firebase-appcheck') { const origin = request.headers.get('origin'); if (origin && env.ALLOWED_ORIGIN.split(',').includes(origin)) { response.headers.set('access-control-allow-origin', origin); response.headers.set('access-control-allow-headers', headers); response.headers.set('access-control-allow-methods', methods); response.headers.set('vary', 'Origin') } return response }
function safeDecode(value: string) { try { return decodeURIComponent(value) } catch { return '' } }
