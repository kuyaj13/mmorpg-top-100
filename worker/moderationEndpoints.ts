import type { VerifiedAdministrator } from './adminAuth'
import type { ModerationRepository } from './db/moderationRepository'

type Dependencies = {
  allowedOrigins: readonly string[]
  verifyAdmin(request: Request): Promise<VerifiedAdministrator | null>
  deriveModeratorKey(uid: string): Promise<Uint8Array>
  repository: ModerationRepository
  rateLimit(key: string): Promise<{ success: boolean }>
}
const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const reasons = new Set(['not_eligible', 'duplicate', 'unsafe_website', 'insufficient_details', 'other'])
function error(message: string, status: number) { return Response.json({ ok: false, message }, { status, headers }) }
async function readDecision(request: Request): Promise<unknown> {
  const length = Number(request.headers.get('content-length') ?? '0')
  if (!Number.isFinite(length) || length > 1024) throw new Error('invalid body')
  const reader = request.body?.getReader(); if (!reader) throw new Error('missing body')
  const chunks: Uint8Array[] = []; let size = 0
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 1024) { await reader.cancel(); throw new Error('invalid body') }; chunks.push(value) }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder().decode(bytes))
}

async function authorize(request: Request, dependencies: Dependencies, action: string): Promise<VerifiedAdministrator | Response> {
  const client = request.headers.get('cf-connecting-ip') ?? 'unknown-client'
  if (!(await dependencies.rateLimit(`${client}:admin:${action}`)).success) return Response.json({ ok: false, message: 'Too many requests. Please try again shortly.' }, { status: 429, headers: { ...headers, 'retry-after': '60' } })
  const origin = request.headers.get('origin')
  if (!origin || !dependencies.allowedOrigins.includes(origin)) return error('Administrator access is required.', 403)
  return await dependencies.verifyAdmin(request) ?? error('Administrator access is required.', 403)
}

export function createModerationEndpoints(dependencies: Dependencies) {
  return {
    async list(request: Request): Promise<Response> {
      if (request.method !== 'GET') return Response.json({ ok: false, message: 'Method not allowed.' }, { status: 405, headers: { ...headers, allow: 'GET' } })
      const admin = await authorize(request, dependencies, 'list-submissions')
      if (admin instanceof Response) return admin
      return Response.json({ ok: true, submissions: await dependencies.repository.listPending() }, { headers })
    },
    async decide(request: Request, submissionId: string): Promise<Response> {
      if (request.method !== 'POST') return Response.json({ ok: false, message: 'Method not allowed.' }, { status: 405, headers: { ...headers, allow: 'POST' } })
      const admin = await authorize(request, dependencies, 'decide-submission')
      if (admin instanceof Response) return admin
      if (!uuid.test(submissionId) || !request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return error('Please submit a valid moderation decision.', 400)
      let body: unknown
      try { body = await readDecision(request) } catch { return error('Please submit a valid moderation decision.', 400) }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return error('Please submit a valid moderation decision.', 400)
      const record = body as Record<string, unknown>
      if (Object.keys(record).some((key) => key !== 'decision' && key !== 'reasonCode' && key !== 'operationId')) return error('Please submit a valid moderation decision.', 400)
      const decision = record.decision
      const reasonCode = record.reasonCode
      const operationId = record.operationId
      if ((decision !== 'approve' && decision !== 'reject') || typeof operationId !== 'string' || !uuid.test(operationId)) return error('Please submit a valid moderation decision.', 400)
      if ((decision === 'approve' && reasonCode !== undefined) || (decision === 'reject' && (typeof reasonCode !== 'string' || !reasons.has(reasonCode)))) return error('Please submit a valid moderation decision.', 400)
      const result = await dependencies.repository.decide(submissionId, await dependencies.deriveModeratorKey(admin.uid), decision, reasonCode as string | undefined, operationId)
      if (result.outcome === 'approved') return Response.json({ ok: true, message: 'The listing was approved.', serverId: result.serverId }, { headers })
      if (result.outcome === 'rejected') return Response.json({ ok: true, message: 'The listing was rejected.' }, { headers })
      if (result.outcome === 'duplicate') return error('This server is already listed.', 409)
      if (result.outcome === 'game_unavailable') return error('This game is no longer available.', 409)
      return error('This submission is no longer pending review.', 409)
    },
  }
}
