import { describe, expect, it, vi } from 'vitest'
import type { RankingRepository } from './db/rankingRepository'
import { createWorker } from './index'

const rateLimit = vi.fn().mockResolvedValue({ success: true })
const env = {
  ALLOWED_ORIGIN: 'https://mmorpgtop100.com,https://www.mmorpgtop100.com,https://mmorpg-top-100.pages.dev' as const,
  HYPERDRIVE: { connectionString: '' } as Hyperdrive,
  RANKINGS_RATE_LIMITER: { limit: rateLimit } as RateLimit,
  VOTE_RATE_LIMITER: { limit: rateLimit } as RateLimit,
  SUBMISSION_RATE_LIMITER: { limit: rateLimit } as RateLimit,
  VOTING_ENABLED: 'false',
  SUBMISSIONS_ENABLED: 'false',
  FIREBASE_PROJECT_ID: 'project',
  TURNSTILE_SECRET: 'secret',
  TURNSTILE_HOSTNAME: 'mmorpgtop100.com',
  TURNSTILE_ACTION: 'vote',
  SUBMISSION_TURNSTILE_ACTION: 'submit-server',
  BANNER_TURNSTILE_ACTION: 'banner-upload',
  DONATION_TURNSTILE_ACTION: 'donation-claim',
  VOTER_HMAC_SECRET: 'secret',
  OWNER_HMAC_SECRET: 'secret',
  ADMIN_ENABLED: 'false',
  PAID_WORKFLOW_RELEASED: 'false',
  ADMIN_RATE_LIMITER: { limit: rateLimit } as RateLimit,
  MODERATOR_HMAC_SECRET: 'secret',
  BANNER_UPLOADS_ENABLED: 'false',
  EXCLUSIVE_BANNER_UPLOADS_ENABLED: 'false',
  EXCLUSIVE_BANNER_MODERATION_ENABLED: 'false',
  EXCLUSIVE_ADS_ENABLED: 'false',
  BANNER_MODERATION_ENABLED: 'false',
  DONATION_CLAIMS_ENABLED: 'false',
  ADVERTISING_WORKSPACE_ENABLED: 'false',
  DONATION_MODERATION_ENABLED: 'false',
  PLACEMENT_MODERATION_ENABLED: 'false',
  ADVERTISING_RATE_LIMITER: { limit: rateLimit } as RateLimit,
}

function repository(result: Awaited<ReturnType<RankingRepository['findByGameSlug']>>): RankingRepository {
  return { findByGameSlug: vi.fn().mockResolvedValue(result), listApprovedServers: vi.fn().mockResolvedValue([]) }
}

describe('rankings endpoint', () => {
  it('returns a game-scoped public response', async () => {
    const server = { id: 'one', name: 'One', website: 'https://one.example/', votes: 2, gameVersion: null, region: null, mode: null, description: null, banner: null }
    const repo = repository({ game: { slug: 'flyff', name: 'Flyff' }, servers: [server] })
    const response = await createWorker(() => repo).fetch(new Request('https://api.example/api/games/flyff/rankings'), env)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, game: { slug: 'flyff', name: 'Flyff' }, servers: [server] })
    expect(repo.findByGameSlug).toHaveBeenCalledWith('flyff')
  })

  it('returns approved servers for cross-game discovery', async () => {
    const repo = repository(null)
    vi.mocked(repo.listApprovedServers).mockResolvedValue([{ id: 'one', name: 'One', website: 'https://one.example/', votes: 2, gameVersion: null, region: null, mode: null, description: null, banner: null, game: { slug: 'flyff', name: 'Flyff' } }])
    const response = await createWorker(() => repo).fetch(new Request('https://api.example/api/servers'), env)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true, servers: [{ name: 'One', game: { slug: 'flyff' } }] })
  })

  it('rejects writes to approved-server discovery without a database call', async () => {
    const repo = repository(null)
    const response = await createWorker(() => repo).fetch(new Request('https://api.example/api/servers', { method: 'POST' }), env)
    expect(response.status).toBe(405)
    expect(repo.listApprovedServers).not.toHaveBeenCalled()
  })

  it('rate limits approved-server discovery before querying the database', async () => {
    const repo = repository(null)
    const limitedEnv = { ...env, RANKINGS_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: false }) } }
    const response = await createWorker(() => repo).fetch(new Request('https://api.example/api/servers'), limitedEnv)
    expect(response.status).toBe(429)
    expect(repo.listApprovedServers).not.toHaveBeenCalled()
  })

  it('applies the exact CORS allowlist to approved-server discovery', async () => {
    const worker = createWorker(() => repository(null))
    for (const origin of env.ALLOWED_ORIGIN.split(',')) {
      const response = await worker.fetch(new Request('https://api.example/api/servers', { headers: { origin } }), env)
      expect(response.headers.get('access-control-allow-origin')).toBe(origin)
    }
    const denied = await worker.fetch(new Request('https://api.example/api/servers', { headers: { origin: 'https://mmorpgtop100.com.evil.test' } }), env)
    expect(denied.headers.has('access-control-allow-origin')).toBe(false)
  })

  it('rejects invalid slugs before querying the database', async () => {
    const repo = repository(null)
    const response = await createWorker(() => repo).fetch(new Request('https://api.example/api/games/Flyff/rankings'), env)
    expect(response.status).toBe(400)
    expect(repo.findByGameSlug).not.toHaveBeenCalled()
  })

  it('does not fall back when a game is unavailable', async () => {
    const response = await createWorker(() => repository(null)).fetch(new Request('https://api.example/api/games/unknown/rankings'), env)
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ message: 'This game is not available.' })
  })

  it('rejects writes without a database call', async () => {
    const repo = repository(null)
    const response = await createWorker(() => repo).fetch(new Request('https://api.example/api/games/flyff/rankings', { method: 'POST' }), env)
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET')
    expect(repo.findByGameSlug).not.toHaveBeenCalled()
  })

  it('rate limits before querying the database', async () => {
    const repo = repository(null)
    const limitedEnv = {
      ...env,
      RANKINGS_RATE_LIMITER: { limit: vi.fn().mockResolvedValue({ success: false }) },
    }
    const response = await createWorker(() => repo).fetch(new Request('https://api.example/api/games/flyff/rankings'), limitedEnv)
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(repo.findByGameSlug).not.toHaveBeenCalled()
  })

  it('allows CORS only for the configured exact origin', async () => {
    const worker = createWorker(() => repository(null))
    const allowedOrigin = 'https://mmorpg-top-100.pages.dev'
    const allowed = await worker.fetch(new Request('https://api.example/api/games/flyff/rankings', { headers: { origin: allowedOrigin } }), env)
    const lookalike = await worker.fetch(new Request('https://api.example/api/games/flyff/rankings', { headers: { origin: `${allowedOrigin}.evil.test` } }), env)
    expect(allowed.headers.get('access-control-allow-origin')).toBe(allowedOrigin)
    expect(lookalike.headers.has('access-control-allow-origin')).toBe(false)
  })

  it('keeps failures generic', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const failing: RankingRepository = { findByGameSlug: vi.fn().mockRejectedValue(new Error('sensitive database detail')), listApprovedServers: vi.fn().mockResolvedValue([]) }
    const response = await createWorker(() => failing).fetch(new Request('https://api.example/api/games/private-game/rankings'), env)
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('database detail')
    const requestId = response.headers.get('x-request-id')
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
    const entry = JSON.parse(String(logged.mock.calls[0][0]))
    expect(entry).toMatchObject({ event: 'request_failed', requestId, method: 'GET', route: 'rankings', errorType: 'Error' })
    expect(JSON.stringify(entry)).not.toContain('private-game')
    expect(JSON.stringify(entry)).not.toContain('database detail')
  })

  it('keeps donation claims unavailable', async () => {
    const response = await createWorker(() => repository(null)).fetch(new Request('https://api.example/api/advertising/claims', { method: 'POST' }), env)
    expect(response.status).toBe(503)
  })

  it('keeps the paid owner workspace disabled when individual flags are on but the master release is off', async () => {
    const advertisingWorkspace = vi.fn()
    const advertising = {
      ownerWorkspace: vi.fn(), advertisingWorkspace, submitClaim: vi.fn(), listPendingClaims: vi.fn(), moderateClaim: vi.fn(),
      upload: vi.fn(), listPublic: vi.fn(), banner: vi.fn(), listPending: vi.fn(), previewPending: vi.fn(), moderate: vi.fn(), listPlacements: vi.fn(), moderatePlacement: vi.fn(),
    }
    const worker = createWorker(() => repository(null), undefined, undefined, undefined, () => advertising)
    const response = await worker.fetch(new Request('https://api.example/api/advertising/workspace', {
      headers: { origin: 'https://mmorpgtop100.com' },
    }), { ...env, ADVERTISING_WORKSPACE_ENABLED: 'true', DONATION_CLAIMS_ENABLED: 'true' })
    expect(response.status).toBe(503)
    expect(advertisingWorkspace).not.toHaveBeenCalled()
  })

  it('routes the paid owner workspace only when its dedicated gate is enabled', async () => {
    const advertisingWorkspace = vi.fn().mockResolvedValue(Response.json({ ok: true, servers: [], packages: [], claims: [] }))
    const advertising = {
      ownerWorkspace: vi.fn(), advertisingWorkspace, submitClaim: vi.fn(), listPendingClaims: vi.fn(), moderateClaim: vi.fn(),
      upload: vi.fn(), listPublic: vi.fn(), banner: vi.fn(), listPending: vi.fn(), previewPending: vi.fn(), moderate: vi.fn(), listPlacements: vi.fn(), moderatePlacement: vi.fn(),
    }
    const worker = createWorker(() => repository(null), undefined, undefined, undefined, () => advertising)
    const response = await worker.fetch(new Request('https://api.example/api/advertising/workspace', {
      headers: { origin: 'https://mmorpgtop100.com' },
    }), { ...env, PAID_WORKFLOW_RELEASED: 'true', ADVERTISING_WORKSPACE_ENABLED: 'true' })
    expect(response.status).toBe(200)
    expect(advertisingWorkspace).toHaveBeenCalledOnce()
  })

  it('advertises the protected donation claim contract during preflight', async () => {
    const response = await createWorker(() => repository(null)).fetch(new Request('https://api.example/api/advertising/claims', {
      method: 'OPTIONS', headers: { origin: 'https://mmorpgtop100.com' },
    }), env)
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
    expect(response.headers.get('access-control-allow-headers')).toBe('authorization, content-type')
  })

  it('keeps donation moderation unavailable and advertises its protected preflight contract', async () => {
    const worker=createWorker(()=>repository(null))
    const disabled=await worker.fetch(new Request('https://api.example/api/admin/donation-claims',{headers:{origin:'https://mmorpgtop100.com'}}),env)
    const preflight=await worker.fetch(new Request('https://api.example/api/admin/donation-claims/123e4567-e89b-42d3-a456-426614174000/decision',{method:'OPTIONS',headers:{origin:'https://mmorpgtop100.com'}}),env)
    expect(disabled.status).toBe(503)
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
    expect(preflight.headers.get('access-control-allow-headers')).toBe('authorization, content-type')
  })

  it('keeps placement management disabled before invoking its protected handler', async () => {
    const listPlacements = vi.fn()
    const advertising = {
      ownerWorkspace: vi.fn(), advertisingWorkspace: vi.fn(), submitClaim: vi.fn(), listPendingClaims: vi.fn(), moderateClaim: vi.fn(),
      upload: vi.fn(), listPublic: vi.fn(), banner: vi.fn(), listPending: vi.fn(), previewPending: vi.fn(), moderate: vi.fn(), listPlacements, moderatePlacement: vi.fn(),
    }
    const worker = createWorker(() => repository(null), undefined, undefined, undefined, () => advertising)
    const response = await worker.fetch(new Request('https://api.example/api/admin/ad-placements', {
      headers: { origin: 'https://mmorpgtop100.com' },
    }), { ...env, ADMIN_ENABLED: 'true' })
    expect(response.status).toBe(503)
    expect(listPlacements).not.toHaveBeenCalled()
  })

  it('routes placement management only when its dedicated gate is enabled', async () => {
    const listPlacements = vi.fn().mockResolvedValue(Response.json({ ok: true, placements: [] }))
    const advertising = {
      ownerWorkspace: vi.fn(), advertisingWorkspace: vi.fn(), submitClaim: vi.fn(), listPendingClaims: vi.fn(), moderateClaim: vi.fn(),
      upload: vi.fn(), listPublic: vi.fn(), banner: vi.fn(), listPending: vi.fn(), previewPending: vi.fn(), moderate: vi.fn(), listPlacements, moderatePlacement: vi.fn(),
    }
    const worker = createWorker(() => repository(null), undefined, undefined, undefined, () => advertising)
    const response = await worker.fetch(new Request('https://api.example/api/admin/ad-placements', {
      headers: { origin: 'https://mmorpgtop100.com' },
    }), { ...env, PAID_WORKFLOW_RELEASED: 'true', ADMIN_ENABLED: 'true', PLACEMENT_MODERATION_ENABLED: 'true' })
    expect(response.status).toBe(200)
    expect(listPlacements).toHaveBeenCalledOnce()
  })

  it('keeps voting disabled before invoking the protected handler', async () => {
    const voteHandler = vi.fn()
    const worker = createWorker(() => repository(null), () => voteHandler)
    const response = await worker.fetch(new Request('https://api.example/api/servers/123e4567-e89b-42d3-a456-426614174000/votes', {
      method: 'POST', headers: { origin: 'https://mmorpgtop100.com' },
    }), env)
    expect(response.status).toBe(503)
    expect(voteHandler).not.toHaveBeenCalled()
  })

  it('rejects a disallowed vote origin before invoking security or database work', async () => {
    const voteHandler = vi.fn()
    const worker = createWorker(() => repository(null), () => voteHandler)
    const response = await worker.fetch(new Request('https://api.example/api/servers/123e4567-e89b-42d3-a456-426614174000/votes', {
      method: 'POST', headers: { origin: 'https://evil.test' },
    }), { ...env, VOTING_ENABLED: 'true' })
    expect(response.status).toBe(403)
    expect(voteHandler).not.toHaveBeenCalled()
  })

  it('advertises POST only for vote preflight', async () => {
    const worker = createWorker(() => repository(null))
    const response = await worker.fetch(new Request('https://api.example/api/servers/123e4567-e89b-42d3-a456-426614174000/votes', {
      method: 'OPTIONS', headers: { origin: 'https://mmorpgtop100.com' },
    }), env)
    expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
  })

  it('keeps submissions disabled before invoking the protected handler', async () => {
    const submissionHandler = vi.fn()
    const worker = createWorker(() => repository(null), undefined, () => submissionHandler)
    const response = await worker.fetch(new Request('https://api.example/api/server-submissions', {
      method: 'POST', headers: { origin: 'https://mmorpgtop100.com' },
    }), env)
    expect(response.status).toBe(503)
    expect(submissionHandler).not.toHaveBeenCalled()
  })

  it('rejects a disallowed submission origin before invoking protected work', async () => {
    const submissionHandler = vi.fn()
    const worker = createWorker(() => repository(null), undefined, () => submissionHandler)
    const response = await worker.fetch(new Request('https://api.example/api/server-submissions', {
      method: 'POST', headers: { origin: 'https://evil.test' },
    }), { ...env, SUBMISSIONS_ENABLED: 'true' })
    expect(response.status).toBe(403)
    expect(submissionHandler).not.toHaveBeenCalled()
  })

  it('advertises only required headers for submission preflight', async () => {
    const response = await createWorker(() => repository(null)).fetch(new Request('https://api.example/api/server-submissions', {
      method: 'OPTIONS', headers: { origin: 'https://www.mmorpgtop100.com' },
    }), env)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://www.mmorpgtop100.com')
    expect(response.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
    expect(response.headers.get('access-control-allow-headers')).toBe('authorization, content-type')
  })

  it('advertises the Turnstile token header for banner upload preflight', async () => {
    const response = await createWorker(() => repository(null)).fetch(new Request(`https://api.example/api/advertising/servers/123e4567-e89b-42d3-a456-426614174000/banner`, {
      method: 'OPTIONS', headers: { origin: 'https://mmorpgtop100.com' },
    }), env)
    expect(response.headers.get('access-control-allow-methods')).toBe('PUT, OPTIONS')
    expect(response.headers.get('access-control-allow-headers')).toBe('authorization, content-type, x-banner-alt-text, x-turnstile-token')
    expect(response.headers.get('access-control-allow-headers')).not.toContain('x-firebase-appcheck')
  })

  it('keeps exclusive banner uploads disabled when free banner uploads are enabled', async () => {
    const upload = vi.fn()
    const advertising = {
      ownerWorkspace: vi.fn(), advertisingWorkspace: vi.fn(), submitClaim: vi.fn(), listPendingClaims: vi.fn(), moderateClaim: vi.fn(),
      upload, listPublic: vi.fn(), banner: vi.fn(), listPending: vi.fn(), previewPending: vi.fn(), moderate: vi.fn(), listPlacements: vi.fn(), moderatePlacement: vi.fn(),
    }
    const worker = createWorker(() => repository(null), undefined, undefined, undefined, () => advertising)
    const response = await worker.fetch(new Request('https://api.example/api/advertising/servers/123e4567-e89b-42d3-a456-426614174000/exclusive-banner', {
      method: 'PUT', headers: { origin: 'https://mmorpgtop100.com' },
    }), { ...env, BANNER_UPLOADS_ENABLED: 'true' })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ message: 'Exclusive banner uploads are not available yet.' })
    expect(upload).not.toHaveBeenCalled()
  })

  it('routes exclusive banner uploads only when both upload gates are enabled', async () => {
    const upload = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    const advertising = {
      ownerWorkspace: vi.fn(), advertisingWorkspace: vi.fn(), submitClaim: vi.fn(), listPendingClaims: vi.fn(), moderateClaim: vi.fn(),
      upload, listPublic: vi.fn(), banner: vi.fn(), listPending: vi.fn(), previewPending: vi.fn(), moderate: vi.fn(), listPlacements: vi.fn(), moderatePlacement: vi.fn(),
    }
    const worker = createWorker(() => repository(null), undefined, undefined, undefined, () => advertising)
    const response = await worker.fetch(new Request('https://api.example/api/advertising/servers/123e4567-e89b-42d3-a456-426614174000/exclusive-banner', {
      method: 'PUT', headers: { origin: 'https://mmorpgtop100.com' },
    }), { ...env, PAID_WORKFLOW_RELEASED: 'true', BANNER_UPLOADS_ENABLED: 'true', EXCLUSIVE_BANNER_UPLOADS_ENABLED: 'true' })
    expect(response.status).toBe(200)
    expect(upload).toHaveBeenCalledWith(expect.any(Request), '123e4567-e89b-42d3-a456-426614174000', 'exclusive')
  })

  it('allows the exclusive banner upload browser preflight with PUT and upload headers', async () => {
    const worker = createWorker(() => repository(null))
    const response = await worker.fetch(new Request('https://api.example/api/advertising/servers/123e4567-e89b-42d3-a456-426614174000/exclusive-banner', {
      method: 'OPTIONS',
      headers: { origin: 'https://mmorpgtop100.com' },
    }), env)

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-methods')).toBe('PUT, OPTIONS')
    expect(response.headers.get('access-control-allow-headers')).toBe('authorization, content-type, x-banner-alt-text, x-turnstile-token')
  })

  it('serves an approved public banner independently from paid advertising', async () => {
    const banner = vi.fn().mockResolvedValue(new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } }))
    const advertising = {
      ownerWorkspace: vi.fn(),advertisingWorkspace:vi.fn(), submitClaim: vi.fn(), listPendingClaims: vi.fn(), moderateClaim: vi.fn(),
      upload: vi.fn(), listPublic: vi.fn(), banner, listPending: vi.fn(), previewPending: vi.fn(), moderate: vi.fn(),listPlacements:vi.fn(),moderatePlacement:vi.fn(),
    }
    const worker = createWorker(() => repository(null), undefined, undefined, undefined, () => advertising)
    const response = await worker.fetch(new Request('https://api.example/api/advertising/banners/62719124-cb58-41e6-8086-3bc241394f5d'), env)
    expect(response.status).toBe(200)
    expect(banner).toHaveBeenCalledOnce()
  })

  it('keeps the owner banner workspace unavailable while its feature flag is off', async () => {
    const response = await createWorker(() => repository(null)).fetch(new Request('https://api.example/api/advertising/owner-workspace', {
      headers: { origin: 'https://mmorpgtop100.com' },
    }), env)
    expect(response.status).toBe(503)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://mmorpgtop100.com')
  })

  it('routes the enabled owner workspace through the protected advertising boundary', async () => {
    const ownerWorkspace = vi.fn().mockResolvedValue(Response.json({ ok: true, servers: [] }))
    const advertising = {
      ownerWorkspace,advertisingWorkspace:vi.fn(), submitClaim: vi.fn(), listPendingClaims: vi.fn(), moderateClaim: vi.fn(),
      upload: vi.fn(), listPublic: vi.fn(), banner: vi.fn(), listPending: vi.fn(), previewPending: vi.fn(), moderate: vi.fn(),listPlacements:vi.fn(),moderatePlacement:vi.fn(),
    }
    const worker = createWorker(() => repository(null), undefined, undefined, undefined, () => advertising)
    const response = await worker.fetch(new Request('https://api.example/api/advertising/owner-workspace', {
      headers: { origin: 'https://mmorpgtop100.com' },
    }), { ...env, BANNER_UPLOADS_ENABLED: 'true' })
    expect(response.status).toBe(200)
    expect(ownerWorkspace).toHaveBeenCalledOnce()
  })
})
