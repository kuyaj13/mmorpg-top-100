import { describe, expect, it, vi } from 'vitest'
import type { VoteRepository } from './db/voteRepository'
import { createVoteEndpoint } from './voteEndpoint'

const serverId = '123e4567-e89b-42d3-a456-426614174000'

function setup(overrides: Partial<Parameters<typeof createVoteEndpoint>[0]> = {}) {
  const repository: VoteRepository = { castDailyVote: vi.fn().mockResolvedValue({ recorded: true, votes: 8 }) }
  const dependencies = {
    verifyFirebase: vi.fn().mockResolvedValue({ uid: 'firebase-user' }),
    verifyTurnstile: vi.fn().mockResolvedValue(true),
    deriveVoterKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
    repository,
    rateLimit: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  }
  const request = new Request('https://api.example/api/votes', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.1' },
    body: JSON.stringify({ turnstileToken: 'proof' }),
  })
  const endpoint = createVoteEndpoint(dependencies)
  return { dependencies, request, endpoint: (value: Request) => endpoint(value, serverId) }
}

describe('vote endpoint', () => {
  it('rate limits before reading identity or database state', async () => {
    const { endpoint, request, dependencies } = setup({ rateLimit: vi.fn().mockResolvedValue({ success: false }) })
    expect((await endpoint(request)).status).toBe(429)
    expect(dependencies.verifyFirebase).not.toHaveBeenCalled()
    expect(dependencies.repository.castDailyVote).not.toHaveBeenCalled()
  })

  it('fails closed with the same public error when Firebase or Turnstile verification fails', async () => {
    const firebase = setup({ verifyFirebase: vi.fn().mockResolvedValue(null) })
    const turnstile = setup({ verifyTurnstile: vi.fn().mockResolvedValue(false) })
    const firebaseResponse = await firebase.endpoint(firebase.request)
    const turnstileResponse = await turnstile.endpoint(turnstile.request)
    expect(firebaseResponse.status).toBe(401)
    expect(turnstileResponse.status).toBe(401)
    expect(await firebaseResponse.json()).toEqual(await turnstileResponse.json())
    expect(firebase.dependencies.repository.castDailyVote).not.toHaveBeenCalled()
    expect(turnstile.dependencies.repository.castDailyVote).not.toHaveBeenCalled()
  })

  it('derives a voter key only after all verification succeeds and records the vote', async () => {
    const { endpoint, request, dependencies } = setup()
    const response = await endpoint(request)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, votes: 8 })
    expect(dependencies.deriveVoterKey).toHaveBeenCalledWith('firebase-user')
    expect(dependencies.repository.castDailyVote).toHaveBeenCalledWith(serverId, new Uint8Array(32))
  })

  it('reports duplicate and inactive-server outcomes without changing them', async () => {
    const duplicate = setup({ repository: { castDailyVote: vi.fn().mockResolvedValue({ recorded: false, votes: 8 }) } })
    const inactive = setup({ repository: { castDailyVote: vi.fn().mockResolvedValue(null) } })
    expect((await duplicate.endpoint(duplicate.request)).status).toBe(409)
    expect((await inactive.endpoint(inactive.request)).status).toBe(404)
  })

  it('rejects malformed and oversized bodies before verification', async () => {
    const malformed = setup()
    malformed.request = new Request('https://api.example/api/votes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    expect((await malformed.endpoint(malformed.request)).status).toBe(400)
    expect(malformed.dependencies.verifyFirebase).not.toHaveBeenCalled()

    const oversized = setup()
    oversized.request = new Request('https://api.example/api/votes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'x'.repeat(4097) })
    expect((await oversized.endpoint(oversized.request)).status).toBe(400)
    expect(oversized.dependencies.verifyFirebase).not.toHaveBeenCalled()
  })
})
