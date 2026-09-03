import type { VerifiedAdministrator } from './adminAuth'
import type { VerifiedFirebaseUser } from './auth'
import { validateBanner } from './bannerValidation'
import type { AdvertisingRepository } from './db/advertisingRepository'

type Dependencies = {
  allowedOrigins: readonly string[]
  verifyOwner(request: Request): Promise<VerifiedFirebaseUser | null>
  verifyTurnstile(token: string, remoteIp?: string): Promise<boolean>
  verifyAdmin(request: Request): Promise<VerifiedAdministrator | null>
  deriveOwnerKey(uid: string): Promise<Uint8Array>
  deriveModeratorKey(uid: string): Promise<Uint8Array>
  rateLimit(key: string): Promise<{ success: boolean }>
  repository: AdvertisingRepository
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const safe = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
const decisions = new Set(['approve', 'reject', 'suspend'])
const error = (message: string, status: number, extra?: HeadersInit) => Response.json({ ok: false, message }, { status, headers: { ...safe, ...extra } })

async function authorize(request: Request, dependencies: Dependencies, role: 'owner' | 'admin', action: string) {
  const client = request.headers.get('cf-connecting-ip') ?? 'unknown-client'
  if (!(await dependencies.rateLimit(`${client}:${action}`)).success) return error('Too many requests. Please try again later.', 429, { 'retry-after': '60' })
  const origin = request.headers.get('origin')
  if (!origin || !dependencies.allowedOrigins.includes(origin)) return error(role === 'admin' ? 'Administrator access is required.' : 'Your upload could not be verified.', 403)
  const user = role === 'admin' ? await dependencies.verifyAdmin(request) : await dependencies.verifyOwner(request)
  return user ?? error(role === 'admin' ? 'Administrator access is required.' : 'Your upload could not be verified.', role === 'admin' ? 403 : 401)
}

function validContentLength(request: Request) {
  const raw = request.headers.get('content-length')
  if (!raw || !/^\d+$/.test(raw)) return false
  const length = Number(raw)
  return Number.isSafeInteger(length) && length > 0 && length <= 524_288
}

async function readBannerBytes(request: Request): Promise<Uint8Array | null> {
  const reader = request.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []; let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 524_288) { await reader.cancel(); return null }
    chunks.push(value)
  }
  if (size < 1) return null
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return bytes
}

async function readDecision(request: Request): Promise<{ decision: 'approve' | 'reject' | 'suspend'; operationId: string } | null> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null
  const rawLength = request.headers.get('content-length')
  if (rawLength && (!/^\d+$/.test(rawLength) || Number(rawLength) > 512)) return null
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength < 1 || bytes.byteLength > 512) return null
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const record = value as Record<string, unknown>
    if (Object.keys(record).some((key) => key !== 'decision' && key !== 'operationId')) return null
    if (typeof record.decision !== 'string' || !decisions.has(record.decision) || typeof record.operationId !== 'string' || !uuid.test(record.operationId)) return null
    return { decision: record.decision as 'approve' | 'reject' | 'suspend', operationId: record.operationId }
  } catch { return null }
}

export function createAdvertisingEndpoints(dependencies: Dependencies) {
  return {
    async ownerWorkspace(request: Request): Promise<Response> {
      if (request.method !== 'GET') return error('Method not allowed.', 405, { allow: 'GET' })
      const owner = await authorize(request, dependencies, 'owner', 'owner-banner-workspace')
      if (owner instanceof Response) return owner
      const servers = await dependencies.repository.listOwnedServers(await dependencies.deriveOwnerKey(owner.uid))
      return Response.json({ ok: true, servers }, { headers: safe })
    },

    async upload(request: Request, serverId: string): Promise<Response> {
      if (request.method !== 'PUT') return error('Method not allowed.', 405, { allow: 'PUT' })
      const owner = await authorize(request, dependencies, 'owner', 'banner-upload')
      if (owner instanceof Response) return owner
      const turnstileToken = request.headers.get('x-turnstile-token')
      if (!turnstileToken || turnstileToken.length > 2048 || !await dependencies.verifyTurnstile(turnstileToken, request.headers.get('cf-connecting-ip') ?? undefined)) {
        return error('Your upload could not be verified.', 401)
      }
      const encodedAltText = request.headers.get('x-banner-alt-text')
      let altText = ''
      try { if (encodedAltText && encodedAltText.length <= 2_000) altText = decodeURIComponent(encodedAltText).trim() } catch { /* invalid encoding */ }
      if (!uuid.test(serverId) || !validContentLength(request) || !altText || altText.length < 10 || altText.length > 160) return error('Please check the banner details.', 400)
      const bytes = await readBannerBytes(request)
      if (!bytes) return error('Please choose a valid banner image.', 400)
      const banner = await validateBanner(bytes)
      if (!banner) return error('Please choose a valid 468 by 60 banner image.', 400)
      const outcome = await dependencies.repository.putBanner(serverId, await dependencies.deriveOwnerKey(owner.uid), banner, altText.trim())
      return outcome === 'stored' ? Response.json({ ok: true, message: 'Your banner was submitted for review.' }, { status: 201, headers: safe }) : error('This server is not available for banner uploads.', 404)
    },

    async listPublic(request: Request, gameSlug: string): Promise<Response> {
      if (request.method !== 'GET') return error('Method not allowed.', 405, { allow: 'GET' })
      const ads = await dependencies.repository.listPublic(gameSlug)
      const origin = new URL(request.url).origin
      const advertisements = ads.flatMap((ad) => {
        try {
          const destination = new URL(ad.destinationUrl)
          if (destination.protocol !== 'https:') return []
          const bannerUrl = new URL(`/api/advertising/banners/${ad.bannerId}`, origin)
          const staticBannerUrl = new URL(bannerUrl); staticBannerUrl.searchParams.set('static', '1')
          return [{ id: ad.id, serverId: ad.serverId, gameSlug, serverName: ad.serverName, website: destination.href, bannerUrl: bannerUrl.href, staticBannerUrl: staticBannerUrl.href, altText: ad.altText }]
        } catch { return [] }
      })
      return Response.json({ ok: true, advertisements }, { headers: { ...safe, 'cache-control': 'public, max-age=60' } })
    },

    async banner(request: Request, bannerId: string): Promise<Response> {
      if (request.method !== 'GET') return error('Method not allowed.', 405, { allow: 'GET' })
      if (!uuid.test(bannerId)) return error('Banner not found.', 404)
      const banner = await dependencies.repository.getPublicBanner(bannerId, new URL(request.url).searchParams.get('static') === '1')
      return banner ? new Response(banner.bytes, { headers: { 'content-type': banner.mediaType, 'x-content-type-options': 'nosniff', 'cache-control': 'public, max-age=300', 'content-security-policy': "default-src 'none'; sandbox" } }) : error('Banner not found.', 404)
    },

    async listPending(request: Request): Promise<Response> {
      if (request.method !== 'GET') return error('Method not allowed.', 405, { allow: 'GET' })
      const admin = await authorize(request, dependencies, 'admin', 'list-banners')
      if (admin instanceof Response) return admin
      return Response.json({ ok: true, banners: await dependencies.repository.listPendingBanners() }, { headers: safe })
    },

    async previewPending(request: Request, bannerId: string): Promise<Response> {
      if (request.method !== 'GET') return error('Method not allowed.', 405, { allow: 'GET' })
      const admin = await authorize(request, dependencies, 'admin', 'preview-banner')
      if (admin instanceof Response) return admin
      if (!uuid.test(bannerId)) return error('Banner not found.', 404)
      const banner = await dependencies.repository.getBannerReviewPreview(bannerId)
      return banner ? new Response(banner.bytes, { headers: { 'content-type': banner.mediaType, 'x-content-type-options': 'nosniff', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; sandbox" } }) : error('Banner not found.', 404)
    },

    async moderate(request: Request, bannerId: string): Promise<Response> {
      if (request.method !== 'POST') return error('Method not allowed.', 405, { allow: 'POST' })
      const admin = await authorize(request, dependencies, 'admin', 'moderate-banner')
      if (admin instanceof Response) return admin
      if (!uuid.test(bannerId)) return error('Please submit a valid banner decision.', 400)
      const input = await readDecision(request)
      if (!input) return error('Please submit a valid banner decision.', 400)
      const outcome = await dependencies.repository.moderateBanner(bannerId, await dependencies.deriveModeratorKey(admin.uid), input.decision, input.operationId)
      if (outcome === 'approved') return Response.json({ ok: true, message: 'The banner was approved.' }, { headers: safe })
      if (outcome === 'rejected') return Response.json({ ok: true, message: 'The banner was rejected.' }, { headers: safe })
      if (outcome === 'suspended') return Response.json({ ok: true, message: 'The banner was suspended.' }, { headers: safe })
      return error('This banner is no longer available for review.', 409)
    },
  }
}
