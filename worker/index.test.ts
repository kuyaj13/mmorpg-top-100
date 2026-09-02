import { describe, expect, it, vi } from 'vitest'
import type { RankingRepository } from './db/rankingRepository'
import { createWorker } from './index'

const rateLimit = vi.fn().mockResolvedValue({ success: true })
const env = {
  ALLOWED_ORIGIN: 'https://mmorpgtop100.com,https://mmorpg-top-100.pages.dev' as const,
  HYPERDRIVE: { connectionString: '' } as Hyperdrive,
  RANKINGS_RATE_LIMITER: { limit: rateLimit } as RateLimit,
  VOTE_RATE_LIMITER: { limit: rateLimit } as RateLimit,
  VOTING_ENABLED: 'false',
  FIREBASE_PROJECT_ID: 'project',
  FIREBASE_PROJECT_NUMBER: '123',
  FIREBASE_APP_ID: 'app',
  TURNSTILE_SECRET: 'secret',
  TURNSTILE_HOSTNAME: 'mmorpgtop100.com',
  TURNSTILE_ACTION: 'vote',
  VOTER_HMAC_SECRET: 'secret',
}

function repository(result: Awaited<ReturnType<RankingRepository['findByGameSlug']>>): RankingRepository {
  return { findByGameSlug: vi.fn().mockResolvedValue(result), listApprovedServers: vi.fn().mockResolvedValue([]) }
}

describe('rankings endpoint', () => {
  it('returns a game-scoped public response', async () => {
    const repo = repository({ game: { slug: 'flyff', name: 'Flyff' }, servers: [{ id: 'one', name: 'One', website: 'https://one.example/', votes: 2 }] })
    const response = await createWorker(() => repo).fetch(new Request('https://api.example/api/games/flyff/rankings'), env)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, game: { slug: 'flyff', name: 'Flyff' }, servers: [{ id: 'one', name: 'One', website: 'https://one.example/', votes: 2 }] })
    expect(repo.findByGameSlug).toHaveBeenCalledWith('flyff')
  })

  it('returns approved servers for cross-game discovery', async () => {
    const repo = repository(null)
    vi.mocked(repo.listApprovedServers).mockResolvedValue([{ id: 'one', name: 'One', website: 'https://one.example/', votes: 2, game: { slug: 'flyff', name: 'Flyff' } }])
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
    const failing: RankingRepository = { findByGameSlug: vi.fn().mockRejectedValue(new Error('sensitive database detail')), listApprovedServers: vi.fn().mockResolvedValue([]) }
    const response = await createWorker(() => failing).fetch(new Request('https://api.example/api/games/flyff/rankings'), env)
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('database detail')
  })

  it('keeps donation claims unavailable', async () => {
    const response = await createWorker(() => repository(null)).fetch(new Request('https://api.example/api/advertising/claims', { method: 'POST' }), env)
    expect(response.status).toBe(503)
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
})
