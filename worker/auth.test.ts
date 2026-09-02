import { beforeEach, describe, expect, it, vi } from 'vitest'

const jwtVerify = vi.fn()
vi.mock('jose', () => ({ createRemoteJWKSet: vi.fn(() => 'keys'), jwtVerify }))

const request = new Request('https://api.example/api/votes', {
  headers: { authorization: 'Bearer id-token' },
})
const now = Math.floor(Date.now() / 1000)
const verified = (payload: Record<string, unknown>) => ({ payload: { iat: now, ...payload }, protectedHeader: { typ: 'JWT' } })

describe('Firebase verifier', () => {
  beforeEach(() => jwtVerify.mockReset())

  it('requires a signed Firebase token for the configured project and a verified email', async () => {
    jwtVerify.mockResolvedValueOnce(verified({ sub: 'uid', email_verified: true }))
    const { createFirebaseVerifier } = await import('./auth')
    const verifier = createFirebaseVerifier({ projectId: 'project' })
    await expect(verifier.verify(request)).resolves.toEqual({ uid: 'uid' })
    expect(jwtVerify).toHaveBeenNthCalledWith(1, 'id-token', 'keys', expect.objectContaining({ audience: 'project' }))
  })

  it('fails closed for missing, invalid, or unverified tokens', async () => {
    const { createFirebaseVerifier } = await import('./auth')
    const verifier = createFirebaseVerifier({ projectId: 'project' })
    await expect(verifier.verify(new Request('https://api.example'))).resolves.toBeNull()
    jwtVerify.mockRejectedValueOnce(new Error('invalid'))
    await expect(verifier.verify(request)).resolves.toBeNull()
    jwtVerify.mockResolvedValueOnce(verified({ sub: 'uid', email_verified: false }))
    await expect(verifier.verify(request)).resolves.toBeNull()
  })
})
