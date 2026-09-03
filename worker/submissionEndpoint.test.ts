import { describe, expect, it, vi } from 'vitest'
import type { SubmissionRepository } from './db/submissionRepository'
import { createSubmissionEndpoint } from './submissionEndpoint'

const validBody = {
  gameSlug: 'flyff', name: 'Moonlight Flyff', website: 'https://moonlight.example', gameVersion: 'v22',
  region: 'Global', mode: 'PvE', description: 'A friendly private server community.', turnstileToken: 'proof',
}

function setup(overrides: Partial<Parameters<typeof createSubmissionEndpoint>[0]> = {}, body: unknown = validBody) {
  const repository: SubmissionRepository = { submit: vi.fn().mockResolvedValue({ outcome: 'accepted', submissionId: 'submission-id' }) }
  const dependencies = {
    verifyFirebase: vi.fn().mockResolvedValue({ uid: 'firebase-owner' }),
    verifyTurnstile: vi.fn().mockResolvedValue(true),
    deriveOwnerKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
    repository,
    rateLimit: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  }
  const request = new Request('https://api.example/api/server-submissions', {
    method: 'POST', headers: { 'content-type': 'application/json', 'cf-connecting-ip': '192.0.2.2' }, body: JSON.stringify(body),
  })
  return { endpoint: createSubmissionEndpoint(dependencies), dependencies, request }
}

describe('submission endpoint', () => {
  it('rate limits before authentication and database access', async () => {
    const context = setup({ rateLimit: vi.fn().mockResolvedValue({ success: false }) })
    expect((await context.endpoint(context.request)).status).toBe(429)
    expect(context.dependencies.verifyFirebase).not.toHaveBeenCalled()
    expect(context.dependencies.repository.submit).not.toHaveBeenCalled()
  })

  it('requires Firebase and Turnstile with an indistinguishable public failure', async () => {
    const auth = setup({ verifyFirebase: vi.fn().mockResolvedValue(null) })
    const captcha = setup({ verifyTurnstile: vi.fn().mockResolvedValue(false) })
    const authResponse = await auth.endpoint(auth.request)
    const captchaResponse = await captcha.endpoint(captcha.request)
    expect(authResponse.status).toBe(401)
    expect(captchaResponse.status).toBe(401)
    expect(await authResponse.json()).toEqual(await captchaResponse.json())
    expect(auth.dependencies.repository.submit).not.toHaveBeenCalled()
    expect(captcha.dependencies.repository.submit).not.toHaveBeenCalled()
  })

  it('submits canonical validated data with a derived owner key', async () => {
    const context = setup()
    const response = await context.endpoint(context.request)
    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({ ok: true, reference: 'submission-id' })
    expect(context.dependencies.deriveOwnerKey).toHaveBeenCalledWith('firebase-owner')
    expect(context.dependencies.repository.submit).toHaveBeenCalledWith(expect.objectContaining({
      website: 'https://moonlight.example/', websiteHost: 'moonlight.example', ownerKey: new Uint8Array(32), gameSlug: 'flyff',
    }))
  })

  it('maps duplicate and unavailable-game results to user-safe errors', async () => {
    const duplicate = setup({ repository: { submit: vi.fn().mockResolvedValue({ outcome: 'duplicate' }) } })
    const unavailable = setup({ repository: { submit: vi.fn().mockResolvedValue({ outcome: 'game_unavailable' }) } })
    expect((await duplicate.endpoint(duplicate.request)).status).toBe(409)
    expect((await unavailable.endpoint(unavailable.request)).status).toBe(400)
  })

  it.each([
    [{ ...validBody, gameSlug: 'Flyff' }],
    [{ ...validBody, website: 'http://moonlight.example' }],
    [{ ...validBody, website: 'https://user:secret@moonlight.example' }],
    [{ ...validBody, website: 'https://localhost/' }],
    [{ ...validBody, website: 'https://192.0.2.1/' }],
    [{ ...validBody, website: 'https://moonlight.example:8443/' }],
    [{ ...validBody, website: 'https://moonlight.example/news' }],
    [{ ...validBody, mode: 'unsafe' }],
    [{ ...validBody, extra: 'unexpected' }],
    [{ ...validBody, description: '' }],
  ])('rejects malformed input before authentication', async (body) => {
    const context = setup({}, body)
    expect((await context.endpoint(context.request)).status).toBe(400)
    expect(context.dependencies.verifyFirebase).not.toHaveBeenCalled()
  })

  it('sets Retry-After when rate limited', async () => {
    const context = setup({ rateLimit: vi.fn().mockResolvedValue({ success: false }) })
    expect((await context.endpoint(context.request)).headers.get('retry-after')).toBe('60')
  })
})
