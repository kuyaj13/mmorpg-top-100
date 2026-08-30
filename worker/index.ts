import { createRemoteJWKSet, jwtVerify } from 'jose'
import { canonicalReference, validUuid } from './validation'
import { ClaimConflictError, ClaimDetailsError, insertDonationClaim, withPrimaryDatabase } from './donationClaimsRepository'

const authKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))
const appCheckKeys = createRemoteJWKSet(new URL('https://firebaseappcheck.googleapis.com/v1/jwks'))

type Identity = { uid: string; admin: boolean; authenticatedAt: number }
type WorkerEnv = Omit<Env, 'CLAIM_MUTATIONS_ENABLED'> & { TURNSTILE_SECRET: string; CLAIM_MUTATIONS_ENABLED: string; PRIMARY_DB: Hyperdrive }

export default {
  async fetch(request, env): Promise<Response> {
    try {
      const url = new URL(request.url)
      if (request.method === 'OPTIONS') return corsResponse(request, env, new Response(null, { status: 204 }))
      if (url.pathname === '/api/health' && request.method === 'GET') return corsResponse(request, env, Response.json({ ok: true, plan: 'free' }))
      if (url.pathname === '/api/advertising/claims' && request.method === 'POST') return corsResponse(request, env, await createClaim(request, env))
      return corsResponse(request, env, jsonError('Not found.', 404))
    } catch (error) {
      if (error instanceof HttpError) return corsResponse(request, env, jsonError(error.message, error.status))
      console.error(JSON.stringify({ event: 'request_failed', error: error instanceof Error ? error.name : 'unknown' }))
      return corsResponse(request, env, jsonError('The request could not be completed.', 500))
    }
  },
} satisfies ExportedHandler<WorkerEnv>

async function createClaim(request: Request, env: WorkerEnv) {
  if (env.CLAIM_MUTATIONS_ENABLED !== 'true') throw new HttpError(503, 'Donation claims are not available yet.')
  const identity = await requireIdentity(request, env)
  await requireAppCheck(request, env)
  const body = await readJson(request)
  const turnstileToken = stringValue(body.turnstileToken, 2048)
  await requireTurnstile(turnstileToken, request, env)
  await enforceLimit(env, identity.uid, 'claim', 5, 60 * 60)

  const serverId = stringValue(body.serverId, 80)
  const packageCode = stringValue(body.packageCode, 40)
  const donorReference = canonicalReference(stringValue(body.donorReference, 128))
  if (!validUuid(serverId) || !['exclusive_7_day', 'exclusive_30_day'].includes(packageCode) || !donorReference) return jsonError('Check the claim details and try again.', 400)

  const claimId = crypto.randomUUID()
  const eventId = crypto.randomUUID()
  const now = new Date().toISOString()
  try {
    await withPrimaryDatabase(env.PRIMARY_DB.connectionString, (client) => insertDonationClaim(client, { claimId, eventId, advertiserUid: identity.uid, serverId, packageCode, donorReference, createdAt: now }))
  } catch (error) {
    if (error instanceof ClaimDetailsError) return jsonError('Check the claim details and try again.', 400)
    if (!(error instanceof ClaimConflictError)) throw error
    return jsonError('This donation claim could not be submitted. Check the details and try again.', 409)
  }
  return Response.json({ ok: true, claimId }, { status: 201, headers: noStoreHeaders() })
}

async function requireIdentity(request: Request, env: WorkerEnv): Promise<Identity> {
  const header = request.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Sign in is required.')
  const token = header.slice(7)
  const { payload } = await jwtVerify(token, authKeys, { issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`, audience: env.FIREBASE_PROJECT_ID })
  if (!payload.sub || payload.email_verified !== true) throw new HttpError(403, 'Verify your email address before continuing.')
  return { uid: payload.sub, admin: payload.admin === true, authenticatedAt: Number(payload.auth_time ?? 0) }
}

async function requireAppCheck(request: Request, env: WorkerEnv) {
  const token = request.headers.get('x-firebase-appcheck')
  if (!token) throw new HttpError(403, 'The request could not be verified.')
  await jwtVerify(token, appCheckKeys, { issuer: `https://firebaseappcheck.googleapis.com/${env.FIREBASE_PROJECT_NUMBER}`, audience: `projects/${env.FIREBASE_PROJECT_NUMBER}` })
}

async function requireTurnstile(token: string, request: Request, env: WorkerEnv) {
  if (!token) throw new HttpError(400, 'Complete the security check.')
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: request.headers.get('cf-connecting-ip') }), headers: { 'content-type': 'application/json' } })
  const result = await response.json<{ success?: boolean }>()
  if (!result.success) throw new HttpError(403, 'The security check was not accepted. Please try again.')
}

async function enforceLimit(env: WorkerEnv, uid: string, action: string, maximum: number, windowSeconds: number) {
  const subjectHash = await sha256Hex(new TextEncoder().encode(`${uid}:${action}`))
  const windowStartedAt = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds
  const count = await env.ADS_DB.prepare('INSERT INTO request_limits(subject_hash, action, window_started_at, request_count) VALUES (?, ?, ?, 1) ON CONFLICT(subject_hash, action, window_started_at) DO UPDATE SET request_count = request_count + 1 RETURNING request_count').bind(subjectHash, action, windowStartedAt).first<number>('request_count')
  if ((count ?? maximum + 1) > maximum) throw new HttpError(429, 'Too many requests. Please try again later.')
}

function stringValue(value: unknown, maximum: number) { return typeof value === 'string' ? value.slice(0, maximum) : '' }
async function readJson(request: Request) { if (!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError(415, 'Use a valid request format.'); return request.json<Record<string, unknown>>() }
async function sha256Hex(bytes: Uint8Array) { const data = Uint8Array.from(bytes).buffer; return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map((byte) => byte.toString(16).padStart(2, '0')).join('') }
function noStoreHeaders() { return { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } }
function jsonError(message: string, status: number) { return Response.json({ ok: false, message }, { status, headers: noStoreHeaders() }) }
function corsResponse(request: Request, env: WorkerEnv, response: Response) { const origin = request.headers.get('origin'); if (origin === env.ALLOWED_ORIGIN) { response.headers.set('access-control-allow-origin', origin); response.headers.set('access-control-allow-headers', 'authorization, content-type, x-firebase-appcheck'); response.headers.set('access-control-allow-methods', 'GET, POST, OPTIONS'); response.headers.set('vary', 'Origin') } return response }

class HttpError extends Error { constructor(readonly status: number, message: string) { super(message) } }
