import type { VerifiedFirebaseUser } from './auth'
import type { NewServerSubmission, SubmissionRepository } from './db/submissionRepository'

type Dependencies = {
  verifyFirebase(request: Request): Promise<VerifiedFirebaseUser | null>
  verifyTurnstile(token: string, remoteIp?: string): Promise<boolean>
  deriveOwnerKey(uid: string): Promise<Uint8Array>
  repository: SubmissionRepository
  rateLimit(key: string): Promise<{ success: boolean }>
}

const gameSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const allowedKeys = new Set(['gameSlug', 'name', 'website', 'gameVersion', 'region', 'mode', 'description', 'turnstileToken'])
const modes = new Set(['PvE', 'PvP', 'RPG'])
const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }

function error(message: string, status: number) {
  return Response.json({ ok: false, message }, { status, headers })
}

async function readJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (!Number.isFinite(declared) || declared > 8192) throw new Error('invalid body')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('missing body')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 8192) { await reader.cancel(); throw new Error('invalid body') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder().decode(bytes))
}

function cleanText(value: unknown, maximum: number): string | null {
  if (typeof value !== 'string') return null
  const clean = value.trim()
  return clean.length > 0 && clean.length <= maximum && ![...clean].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127) ? clean : null
}

function parseBody(value: unknown): (Omit<NewServerSubmission, 'ownerKey'> & { turnstileToken: string }) | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).some((key) => !allowedKeys.has(key)) || Object.keys(record).length !== allowedKeys.size) return null
  const gameSlug = cleanText(record.gameSlug, 100)
  const name = cleanText(record.name, 80)
  const gameVersion = cleanText(record.gameVersion, 60)
  const region = cleanText(record.region, 60)
  const description = cleanText(record.description, 1000)
  const turnstileToken = cleanText(record.turnstileToken, 2048)
  if (!gameSlug || !gameSlugPattern.test(gameSlug) || !name || !gameVersion || !region || !description || !turnstileToken || !modes.has(record.mode as string)) return null

  let website: URL
  try { website = new URL(String(record.website)) } catch { return null }
  if (website.protocol !== 'https:' || website.username || website.password || website.hash || website.search || website.pathname !== '/' || (website.port && website.port !== '443')) return null
  website.hostname = website.hostname.toLowerCase()
  const websiteHost = website.hostname
  if (websiteHost === 'localhost' || websiteHost.endsWith('.local') || !websiteHost.includes('.') || websiteHost.startsWith('[') || /^(?:\d{1,3}\.){3}\d{1,3}$/.test(websiteHost)) return null
  website.port = ''
  return { gameSlug, name, website: website.href, websiteHost, gameVersion, region, mode: record.mode as 'PvE' | 'PvP' | 'RPG', description, turnstileToken }
}

export function createSubmissionEndpoint(dependencies: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return Response.json({ ok: false, message: 'Method not allowed.' }, { status: 405, headers: { ...headers, allow: 'POST' } })
    const clientKey = request.headers.get('cf-connecting-ip') ?? 'unknown-client'
    if (!(await dependencies.rateLimit(`${clientKey}:submit-server`)).success) return Response.json({ ok: false, message: 'Too many requests. Please try again later.' }, { status: 429, headers: { ...headers, 'retry-after': '60' } })
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return error('Please check the server details and try again.', 400)

    let input: ReturnType<typeof parseBody>
    try { input = parseBody(await readJson(request)) } catch { input = null }
    if (!input) return error('Please check the server details and try again.', 400)

    const user = await dependencies.verifyFirebase(request)
    if (!user) return error('Your submission could not be verified. Please try again.', 401)
    if (!await dependencies.verifyTurnstile(input.turnstileToken, request.headers.get('cf-connecting-ip') ?? undefined)) {
      return error('Your submission could not be verified. Please try again.', 401)
    }

    const ownerKey = await dependencies.deriveOwnerKey(user.uid)
    const { turnstileToken: _turnstileToken, ...submission } = input
    void _turnstileToken
    const result = await dependencies.repository.submit({ ...submission, ownerKey })
    if (result.outcome === 'duplicate') return error('This server is already listed or pending review.', 409)
    if (result.outcome === 'game_unavailable') return error('Please choose an available game.', 400)
    if (result.outcome === 'limit_reached') return error('You already have several submissions pending review.', 409)
    if (result.outcome === 'accepted') return Response.json({ ok: true, reference: result.submissionId, message: 'Your server has been submitted for review.' }, { status: 201, headers })
    return error('Your server could not be submitted. Please try again.', 500)
  }
}
