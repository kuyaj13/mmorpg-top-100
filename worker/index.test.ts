import { describe, expect, it, vi } from 'vitest'
import type { RankingRepository } from './db/rankingRepository'
import { createWorker } from './index'

const env = { ALLOWED_ORIGIN: 'https://mmorpgtop100.com' } as Env

function repository(result: Awaited<ReturnType<RankingRepository['findByGameSlug']>>): RankingRepository {
  return { findByGameSlug: vi.fn().mockResolvedValue(result) }
}

describe('rankings endpoint', () => {
  it('returns a game-scoped public response', async () => {
    const repo = repository({ game: { slug: 'flyff', name: 'Flyff' }, servers: [{ id: 'one', name: 'One', votes: '2' }] })
    const response = await createWorker(() => repo).fetch(new Request('https://api.example/api/games/flyff/rankings'), env)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, game: { slug: 'flyff', name: 'Flyff' }, servers: [{ id: 'one', name: 'One', votes: '2' }] })
    expect(repo.findByGameSlug).toHaveBeenCalledWith('flyff')
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

  it('allows CORS only for the configured exact origin', async () => {
    const worker = createWorker(() => repository(null))
    const allowed = await worker.fetch(new Request('https://api.example/api/games/flyff/rankings', { headers: { origin: env.ALLOWED_ORIGIN } }), env)
    const lookalike = await worker.fetch(new Request('https://api.example/api/games/flyff/rankings', { headers: { origin: `${env.ALLOWED_ORIGIN}.evil.test` } }), env)
    expect(allowed.headers.get('access-control-allow-origin')).toBe(env.ALLOWED_ORIGIN)
    expect(lookalike.headers.has('access-control-allow-origin')).toBe(false)
  })

  it('keeps failures generic', async () => {
    const failing: RankingRepository = { findByGameSlug: vi.fn().mockRejectedValue(new Error('sensitive database detail')) }
    const response = await createWorker(() => failing).fetch(new Request('https://api.example/api/games/flyff/rankings'), env)
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('database detail')
  })

  it('keeps donation claims unavailable', async () => {
    const response = await createWorker(() => repository(null)).fetch(new Request('https://api.example/api/advertising/claims', { method: 'POST' }), env)
    expect(response.status).toBe(503)
  })
})
