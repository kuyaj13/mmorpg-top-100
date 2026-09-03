import { describe, expect, it, vi } from 'vitest'
import type { RankingQueryClient } from './rankingRepository'
import { createSubmissionRepository, type NewServerSubmission } from './submissionRepository'

const input: NewServerSubmission = {
  ownerKey: new Uint8Array(32), gameSlug: 'flyff', name: 'Moonlight', website: 'https://moonlight.example/', websiteHost: 'moonlight.example',
  gameVersion: 'v22', region: 'Global', mode: 'PvE', description: 'Community',
}
function client(rows: Record<string, unknown>[]): RankingQueryClient {
  return { connect: vi.fn(), query: vi.fn().mockResolvedValue({ rows }), end: vi.fn() }
}

describe('submission repository', () => {
  it('uses only the constrained submission function', async () => {
    const database = client([{ outcome: 'accepted', submission_id: 'id-one' }])
    await expect(createSubmissionRepository(() => database).submit(input)).resolves.toEqual({ outcome: 'accepted', submissionId: 'id-one' })
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining('api.submit_server'), [
      input.ownerKey, input.gameSlug, input.name, input.website, input.websiteHost, input.gameVersion, input.region, input.mode, input.description,
    ])
    expect(database.end).toHaveBeenCalled()
  })

  it.each(['duplicate', 'game_unavailable', 'limit_reached'] as const)('maps the %s outcome', async (outcome) => {
    await expect(createSubmissionRepository(() => client([{ outcome, submission_id: null }])).submit(input)).resolves.toEqual({ outcome })
  })

  it('rejects unexpected database results and still closes the client', async () => {
    const database = client([{ outcome: 'unexpected', submission_id: null }])
    await expect(createSubmissionRepository(() => database).submit(input)).rejects.toThrow('Invalid submission outcome')
    expect(database.end).toHaveBeenCalled()
  })
})
