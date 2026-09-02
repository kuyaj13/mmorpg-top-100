import { beforeEach, describe, expect, it, vi } from 'vitest'

const jwtVerify = vi.fn()
vi.mock('jose', () => ({ createRemoteJWKSet: vi.fn(() => 'keys'), jwtVerify }))

const request = new Request('https://api.example/api/votes', {
  headers: { authorization: 'Bearer id-token', 'x-firebase-appcheck': 'app-check-token' },
})
const now = Math.floor(Date.now() / 1000)
const verified = (payload: Record<string, unknown>) => ({ payload: { iat: now, ...payload }, protectedHeader: { typ: 'JWT' } })

describe('Firebase verifier', () => {
  beforeEach(() => jwtVerify.mockReset())

  it('requires verified email and the configured App Check app', async () => {
    jwtVerify
      .mockResolvedValueOnce(verified({ sub: 'uid', email_verified: true }))
      .mockResolvedValueOnce(verified({ sub: 'app-id' }))
    const { createFirebaseVerifier } = await import('./auth')
    const verifier = createFirebaseVerifier({ projectId: 'project', projectNumber: '123', appId: 'app-id' })
    await expect(verifier.verify(request)).resolves.toEqual({ uid: 'uid' })
    expect(jwtVerify).toHaveBeenNthCalledWith(1, 'id-token', 'keys', expect.objectContaining({ audience: 'project' }))
    expect(jwtVerify).toHaveBeenNthCalledWith(2, 'app-check-token', 'keys', expect.objectContaining({ audience: 'projects/123' }))
  })

  it('fails closed for missing, invalid, unverified, or wrong-app tokens', async () => {
    const { createFirebaseVerifier } = await import('./auth')
    const verifier = createFirebaseVerifier({ projectId: 'project', projectNumber: '123', appId: 'app-id' })
    await expect(verifier.verify(new Request('https://api.example'))).resolves.toBeNull()
    jwtVerify.mockRejectedValueOnce(new Error('invalid'))
    await expect(verifier.verify(request)).resolves.toBeNull()
    jwtVerify.mockResolvedValueOnce(verified({ sub: 'uid', email_verified: false })).mockResolvedValueOnce(verified({ sub: 'app-id' }))
    await expect(verifier.verify(request)).resolves.toBeNull()
    jwtVerify.mockResolvedValueOnce(verified({ sub: 'uid', email_verified: true })).mockResolvedValueOnce(verified({ sub: 'other-app' }))
    await expect(verifier.verify(request)).resolves.toBeNull()
  })
})
