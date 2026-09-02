import { describe, expect, it, vi } from 'vitest'
import type { RankingQueryClient } from './rankingRepository'
import { createVoteRepository } from './voteRepository'

function client(rows: Record<string, unknown>[]): RankingQueryClient {
  return { connect: vi.fn(), query: vi.fn().mockResolvedValue({ rows }), end: vi.fn() }
}

describe('vote repository', () => {
  it('calls only the constrained database function', async () => {
    const database = client([{ recorded: true, votes: '12' }])
    const key = new Uint8Array(32)
    await expect(createVoteRepository(() => database).castDailyVote('server-id', key)).resolves.toEqual({ recorded: true, votes: 12 })
    expect(database.query).toHaveBeenCalledWith(
      'SELECT recorded, votes::text AS votes FROM api.cast_daily_vote($1::uuid, $2::bytea)',
      ['server-id', key],
    )
    expect(database.end).toHaveBeenCalled()
  })

  it('maps no row to an unavailable server and rejects unsafe totals', async () => {
    await expect(createVoteRepository(() => client([])).castDailyVote('server-id', new Uint8Array(32))).resolves.toBeNull()
    await expect(createVoteRepository(() => client([{ recorded: true, votes: '9007199254740993' }])).castDailyVote('server-id', new Uint8Array(32))).rejects.toThrow('Invalid vote count')
  })
})

