import { describe, expect, it, vi } from 'vitest'
import { createRankingsService } from './rankingsService'

describe('rankingsService', () => {
  it('requests the encoded game endpoint and accepts the minimal contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      ok: true, game: { slug: 'flyff', name: 'Flyff' },
      servers: [{ id: 'one', name: 'Flyff One', votes: 12 }],
    }))
    const result = await createRankingsService(fetcher, 'https://api.example').getGameRankings('flyff')
    expect(fetcher).toHaveBeenCalledWith('https://api.example/api/games/flyff/rankings', expect.objectContaining({ headers: { accept: 'application/json' } }))
    expect(result.servers[0]).toEqual({ id: 'one', name: 'Flyff One', votes: 12 })
  })

  it.each([
    { ok: true, game: { slug: 'other', name: 'Other' }, servers: [] },
    { ok: true, game: { slug: 'flyff', name: 'Flyff' }, servers: [{ id: 'one', name: 'One', votes: -1 }] },
    { ok: true, game: { slug: 'flyff', name: 'Flyff' }, servers: new Array(101).fill({ id: 'one', name: 'One', votes: 1 }) },
  ])('rejects an invalid or cross-game response', async (payload) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload))
    await expect(createRankingsService(fetcher).getGameRankings('flyff')).rejects.toThrow()
  })

  it('rejects non-success responses without exposing response details', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('private detail', { status: 500 }))
    await expect(createRankingsService(fetcher).getGameRankings('flyff')).rejects.toThrow('Rankings request failed')
  })
})
