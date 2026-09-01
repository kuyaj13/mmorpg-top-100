import { describe, expect, it, vi } from 'vitest'
import { createRankingRepository, type RankingQueryClient } from './rankingRepository'

function fakeClient(results: Array<{ rows: Record<string, unknown>[] }>): RankingQueryClient & { query: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> } {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    query: vi.fn().mockImplementation(() => Promise.resolve(results.shift())),
    end: vi.fn().mockResolvedValue(undefined),
  }
}

describe('ranking repository', () => {
  it('scopes both queries to one game and closes the connection', async () => {
    const client = fakeClient([
      { rows: [{ slug: 'flyff', name: 'Flyff' }] },
      { rows: [{ id: 'server-id', name: 'Server', website: 'https://server.example/', votes: '20' }] },
    ])
    await expect(createRankingRepository(() => client).findByGameSlug('flyff')).resolves.toEqual({
      game: { slug: 'flyff', name: 'Flyff' },
      servers: [{ id: 'server-id', name: 'Server', website: 'https://server.example/', votes: 20 }],
    })
    expect(client.query).toHaveBeenNthCalledWith(1, expect.any(String), ['flyff'])
    expect(client.query).toHaveBeenNthCalledWith(2, expect.stringContaining('LIMIT 100'), ['flyff'])
    expect(client.end).toHaveBeenCalledOnce()
  })

  it('rejects vote counts that cannot be represented safely', async () => {
    const client = fakeClient([
      { rows: [{ slug: 'flyff', name: 'Flyff' }] },
      { rows: [{ id: 'server-id', name: 'Server', website: 'https://server.example/', votes: '9007199254740993' }] },
    ])
    await expect(createRankingRepository(() => client).findByGameSlug('flyff')).rejects.toThrow('Invalid public vote count')
    expect(client.end).toHaveBeenCalledOnce()
  })

  it('rejects a non-HTTPS public website', async () => {
    const client = fakeClient([
      { rows: [{ slug: 'flyff', name: 'Flyff' }] },
      { rows: [{ id: 'server-id', name: 'Server', website: 'http://server.example/', votes: '1' }] },
    ])
    await expect(createRankingRepository(() => client).findByGameSlug('flyff')).rejects.toThrow('Invalid public website')
  })

  it('returns null for an unavailable game without querying servers', async () => {
    const client = fakeClient([{ rows: [] }])
    await expect(createRankingRepository(() => client).findByGameSlug('unknown')).resolves.toBeNull()
    expect(client.query).toHaveBeenCalledOnce()
    expect(client.end).toHaveBeenCalledOnce()
  })

  it('lists approved servers with their game for homepage discovery', async () => {
    const client = fakeClient([{ rows: [{ id: 'server-id', name: 'Server', website: 'https://server.example/', votes: '4', game_slug: 'flyff', game_name: 'Flyff' }] }])
    await expect(createRankingRepository(() => client).listApprovedServers()).resolves.toEqual([
      { id: 'server-id', name: 'Server', website: 'https://server.example/', votes: 4, game: { slug: 'flyff', name: 'Flyff' } },
    ])
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT 100'))
    expect(client.end).toHaveBeenCalledOnce()
  })

  it('closes the connection when a query fails', async () => {
    const client = fakeClient([])
    client.query.mockRejectedValueOnce(new Error('database detail'))
    await expect(createRankingRepository(() => client).findByGameSlug('flyff')).rejects.toThrow()
    expect(client.end).toHaveBeenCalledOnce()
  })
})
