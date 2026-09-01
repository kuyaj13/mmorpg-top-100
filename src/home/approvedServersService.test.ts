import { describe, expect, it, vi } from 'vitest'
import { createApprovedServersService } from './approvedServersService'

const validServer = { id: 'one', name: 'One', website: 'https://one.example/', votes: 1, game: { slug: 'flyff', name: 'Flyff' } }

describe('approvedServersService', () => {
  it('accepts the minimal cross-game discovery contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, servers: [validServer] }))
    await expect(createApprovedServersService(fetcher).list()).resolves.toEqual([validServer])
  })

  it.each([
    { ...validServer, website: 'http://one.example/' },
    { ...validServer, votes: -1 },
    { ...validServer, game: null },
    { ...validServer, game: { slug: '../flyff', name: 'Flyff' } },
  ])('rejects unsafe or malformed server data', async (server) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, servers: [server] }))
    await expect(createApprovedServersService(fetcher).list()).rejects.toThrow()
  })

  it('rejects responses larger than the API contract permits', async () => {
    const servers = Array.from({ length: 101 }, (_, index) => ({ ...validServer, id: `server-${index}` }))
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, servers }))
    await expect(createApprovedServersService(fetcher).list()).rejects.toThrow()
  })

  it.each(['../flyff', 'Flyff', 'flyff/', 'flyff--universe'])(
    'rejects the noncanonical game slug %s',
    async (slug) => {
      const server = { ...validServer, game: { ...validServer.game, slug } }
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true, servers: [server] }))
      await expect(createApprovedServersService(fetcher).list()).rejects.toThrow()
    },
  )
})
