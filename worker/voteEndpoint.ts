import type { VerifiedFirebaseUser } from './auth'
import type { VoteRepository } from './db/voteRepository'

type Dependencies = {
  verifyFirebase(request: Request): Promise<VerifiedFirebaseUser | null>
  verifyTurnstile(token: string, remoteIp?: string): Promise<boolean>
  deriveVoterKey(uid: string): Promise<Uint8Array>
  repository: VoteRepository
  rateLimit(key: string): Promise<{ success: boolean }>
}

const genericVerificationError = 'Your vote could not be verified. Please try again.'
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function response(message: string, status: number) {
  return Response.json({ ok: false, message }, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
}

async function readBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > 4096) throw new Error('body too large')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('missing body')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 4096) {
      await reader.cancel()
      throw new Error('body too large')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder().decode(bytes))
}

export function createVoteEndpoint(dependencies: Dependencies) {
  return async (request: Request, serverId: string): Promise<Response> => {
    if (request.method !== 'POST') return Response.json(
      { ok: false, message: 'Method not allowed.' },
      { status: 405, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', allow: 'POST' } },
    )
    const clientKey = request.headers.get('cf-connecting-ip') ?? 'unknown-client'
    const limit = await dependencies.rateLimit(`${clientKey}:vote`)
    if (!limit.success) return response('Too many requests. Please try again shortly.', 429)
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return response('Please submit a valid vote.', 400)

    let body: unknown
    try { body = await readBody(request) } catch { return response('Please submit a valid vote.', 400) }
    if (!body || typeof body !== 'object') return response('Please submit a valid vote.', 400)
    const turnstileToken = Reflect.get(body, 'turnstileToken')
    if (!uuidPattern.test(serverId) || typeof turnstileToken !== 'string' || Object.keys(body as Record<string, unknown>).some((key) => key !== 'turnstileToken')) {
      return response('Please submit a valid vote.', 400)
    }

    const user = await dependencies.verifyFirebase(request)
    if (!user) return response(genericVerificationError, 401)
    if (!await dependencies.verifyTurnstile(turnstileToken, request.headers.get('cf-connecting-ip') ?? undefined)) {
      return response(genericVerificationError, 401)
    }
    const voterKey = await dependencies.deriveVoterKey(user.uid)
    const result = await dependencies.repository.castDailyVote(serverId, voterKey)
    if (!result) return response('This server is not available for voting.', 404)
    if (!result.recorded) return response('You have already voted for this server today.', 409)
    return Response.json({ ok: true, votes: result.votes }, { headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
  }
}
