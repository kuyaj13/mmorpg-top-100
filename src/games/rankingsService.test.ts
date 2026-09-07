import { describe, expect, it, vi } from 'vitest'
import { createRankingsService } from './rankingsService'

describe('rankingsService', () => {
  it('requests the encoded game endpoint and accepts the minimal contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      ok: true, game: { slug: 'flyff', name: 'Flyff' },
      servers: [{ id: 'one', name: 'Flyff One', website: 'https://flyff.example/', votes: 12 }],
    }))
    const result = await createRankingsService(fetcher, 'https://api.example').getGameRankings('flyff')
    expect(fetcher).toHaveBeenCalledWith('https://api.example/api/games/flyff/rankings', expect.objectContaining({ headers: { accept: 'application/json' } }))
    expect(result.servers[0]).toEqual({ id: 'one', name: 'Flyff One', website: 'https://flyff.example/', votes: 12,
      gameVersion: null, region: null, mode: null, description: null, banner: null })
  })

  it('builds trusted banner URLs from approved banner metadata', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, game: { slug: 'flyff', name: 'Flyff' }, servers: [{
      id: 'one', name: 'Flyff One', website: 'https://flyff.example/', votes: 12, gameVersion: 'v22', region: 'Asia', mode: 'PvP',
      description: 'A community-focused Flyff server.', banner: { id: '62719124-cb58-41e6-8086-3bc241394f5d', altText: 'Flyff One server banner' },
    }] }))
    const [server] = (await createRankingsService(fetcher, 'https://api.example').getGameRankings('flyff')).servers
    expect(server.banner).toEqual({ url: 'https://api.example/api/advertising/banners/62719124-cb58-41e6-8086-3bc241394f5d', staticUrl: 'https://api.example/api/advertising/banners/62719124-cb58-41e6-8086-3bc241394f5d?static=1', altText: 'Flyff One server banner' })
    expect(server.description).toBe('A community-focused Flyff server.')
  })

  it.each([
    { ok: true, game: { slug: 'other', name: 'Other' }, servers: [] },
    { ok: true, game: { slug: 'flyff', name: 'Flyff' }, servers: [{ id: 'one', name: 'One', website: 'https://one.example/', votes: -1 }] },
    { ok: true, game: { slug: 'flyff', name: 'Flyff' }, servers: new Array(101).fill({ id: 'one', name: 'One', website: 'https://one.example/', votes: 1 }) },
    { ok: true, game: { slug: 'flyff', name: 'Flyff' }, servers: [{ id: 'one', name: 'One', website: 'http://one.example/', votes: 1 }] },
  ])('rejects an invalid or cross-game response', async (payload) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload))
    await expect(createRankingsService(fetcher).getGameRankings('flyff')).rejects.toThrow()
  })

  it('rejects non-success responses without exposing response details', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('private detail', { status: 500 }))
    await expect(createRankingsService(fetcher).getGameRankings('flyff')).rejects.toThrow('Rankings request failed')
  })
})
