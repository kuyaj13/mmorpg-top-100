import { describe, expect, it, vi } from 'vitest'
import type { ModerationRepository } from './db/moderationRepository'
import { createModerationEndpoints } from './moderationEndpoints'

const id = '123e4567-e89b-42d3-a456-426614174000'
const operationId = '123e4567-e89b-42d3-a456-426614174001'
function setup(overrides: Partial<Parameters<typeof createModerationEndpoints>[0]> = {}) {
  const repository: ModerationRepository = { listPending: vi.fn().mockResolvedValue([{ id, name: 'One' }]), decide: vi.fn().mockResolvedValue({ outcome: 'approved', serverId: id }) } as unknown as ModerationRepository
  const dependencies = { allowedOrigins: ['https://mmorpgtop100.com'], verifyAdmin: vi.fn().mockResolvedValue({ uid: 'admin' }), deriveModeratorKey: vi.fn().mockResolvedValue(new Uint8Array(32)), repository, rateLimit: vi.fn().mockResolvedValue({ success: true }), ...overrides }
  const request = (method = 'GET', body?: unknown, origin = 'https://mmorpgtop100.com') => new Request('https://api.example', { method, headers: { origin, 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.1' }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { endpoints: createModerationEndpoints(dependencies), dependencies, request }
}

describe('moderation endpoints', () => {
  it('rate limits before authorization and database work', async () => {
    const context = setup({ rateLimit: vi.fn().mockResolvedValue({ success: false }) })
    const response = await context.endpoints.list(context.request())
    expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('60')
    expect(context.dependencies.verifyAdmin).not.toHaveBeenCalled(); expect(context.dependencies.repository.listPending).not.toHaveBeenCalled()
  })
  it('requires exact origin and an administrator token', async () => {
    const context = setup()
    expect((await context.endpoints.list(context.request('GET', undefined, 'https://mmorpgtop100.com.evil.test'))).status).toBe(403)
    expect(context.dependencies.verifyAdmin).not.toHaveBeenCalled()
    const denied = setup({ verifyAdmin: vi.fn().mockResolvedValue(null) })
    expect((await denied.endpoints.list(denied.request())).status).toBe(403)
    expect(denied.dependencies.repository.listPending).not.toHaveBeenCalled()
  })
  it('lists pending submissions only after authorization', async () => {
    const context = setup(); const response = await context.endpoints.list(context.request())
    expect(response.status).toBe(200); expect(context.dependencies.repository.listPending).toHaveBeenCalledOnce()
  })
  it('derives the moderator key and approves', async () => {
    const context = setup(); const response = await context.endpoints.decide(context.request('POST', { decision: 'approve', operationId }), id)
    expect(response.status).toBe(200); expect(context.dependencies.deriveModeratorKey).toHaveBeenCalledWith('admin')
    expect(context.dependencies.repository.decide).toHaveBeenCalledWith(id, new Uint8Array(32), 'approve', undefined, operationId)
  })
  it('requires an allowlisted rejection reason', async () => {
    const context = setup()
    expect((await context.endpoints.decide(context.request('POST', { decision: 'reject', reasonCode: 'raw user text', operationId }), id)).status).toBe(400)
    expect(context.dependencies.repository.decide).not.toHaveBeenCalled()
  })
  it.each([['already_resolved', 409], ['duplicate', 409], ['game_unavailable', 409], ['rejected', 200]] as const)('maps %s safely', async (outcome, status) => {
    const context = setup({ repository: { listPending: vi.fn(), decide: vi.fn().mockResolvedValue({ outcome }) } })
    expect((await context.endpoints.decide(context.request('POST', { decision: 'reject', reasonCode: 'other', operationId }), id)).status).toBe(status)
  })
})
