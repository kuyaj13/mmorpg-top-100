import { beforeEach, describe, expect, it, vi } from 'vitest'
const jwtVerify = vi.fn()
vi.mock('jose', () => ({ createRemoteJWKSet: vi.fn(() => 'keys'), jwtVerify }))
const request = new Request('https://api.example', { headers: { authorization: 'Bearer token' } })
describe('administrator verifier', () => {
  beforeEach(() => jwtVerify.mockReset())
  it('requires the exact admin claim, verified email, and recent authentication', async () => {
    const now = Math.floor(Date.now() / 1000)
    jwtVerify.mockResolvedValue({ protectedHeader: { typ: 'JWT' }, payload: { sub: 'uid', admin: true, email_verified: true, iat: now, auth_time: now } })
    const { createAdminVerifier } = await import('./adminAuth')
    await expect(createAdminVerifier('project')(request)).resolves.toEqual({ uid: 'uid' })
  })
  it.each([{ admin: 'true' }, { admin: false }, { email_verified: false }, { auth_time: 0 }])('fails closed for invalid claims', async (change) => {
    const now = Math.floor(Date.now() / 1000)
    jwtVerify.mockResolvedValue({ protectedHeader: { typ: 'JWT' }, payload: { sub: 'uid', admin: true, email_verified: true, iat: now, auth_time: now, ...change } })
    const { createAdminVerifier } = await import('./adminAuth')
    await expect(createAdminVerifier('project')(request)).resolves.toBeNull()
  })
})
