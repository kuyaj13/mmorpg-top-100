import { describe, expect, it, vi } from 'vitest'
import type { RankingQueryClient } from './rankingRepository'
import { createModerationRepository } from './moderationRepository'
function client(rows: Record<string, unknown>[]): RankingQueryClient { return { connect: vi.fn(), query: vi.fn().mockResolvedValue({ rows }), end: vi.fn() } }
describe('moderation repository', () => {
  it('lists through the private API function', async () => {
    const database = client([{ id: 'id', game_slug: 'flyff', game_name: 'Flyff', name: 'One', website: 'https://one.example/', game_version: 'v1', region: 'Global', mode: 'PvE', description: 'Desc', created_at: '2026-09-03T00:00:00Z' }])
    await expect(createModerationRepository(() => database).listPending()).resolves.toEqual([expect.objectContaining({ gameSlug: 'flyff', submittedAt: '2026-09-03T00:00:00.000Z' })])
    expect(database.query).toHaveBeenCalledWith('SELECT * FROM api.list_pending_server_submissions()')
  })
  it('calls only the atomic decision function', async () => {
    const database = client([{ outcome: 'approved', server_id: 'server' }]); const key = new Uint8Array(32)
    await expect(createModerationRepository(() => database).decide('submission', key, 'approve', undefined, 'operation')).resolves.toEqual({ outcome: 'approved', serverId: 'server' })
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('api.moderate_server_submission'), ['submission', key, 'approve', null, 'operation'])
    expect(database.end).toHaveBeenCalled()
  })
})
