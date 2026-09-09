import { describe, expect, it, vi } from 'vitest'
import type { SubmissionRepository } from './db/submissionRepository'
import { createSubmissionEndpoint } from './submissionEndpoint'
import UPNG from 'upng-js'

const validBody = {
  gameSlug: 'flyff', name: 'Moonlight Flyff', website: 'https://moonlight.example', gameVersion: 'v22',
  region: 'Global', mode: 'PvE', description: 'A friendly private server community.', turnstileToken: 'proof',
}

function multipartRequest(banner: Uint8Array, declaredLength?: number) {
  const boundary = 'submission-test-boundary'
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  for (const [key, value] of Object.entries(validBody)) chunks.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`))
  chunks.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="banner"; filename="untrusted.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`), banner,
    encoder.encode(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="bannerAltText"\r\n\r\nMoonlight Flyff colorful server banner\r\n--${boundary}--\r\n`))
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return new Request('https://api.example/api/server-submissions', { method: 'POST', headers: {
    'content-type': `multipart/form-data; boundary=${boundary}`, 'content-length': String(declaredLength ?? size), 'cf-connecting-ip': '192.0.2.2',
  }, body: bytes })
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
  afterEach(() => vi.restoreAllMocks())
  it('rate limits before authentication and database access', async () => {
    const context = setup({ rateLimit: vi.fn().mockResolvedValue({ success: false }) })
    expect((await context.endpoint(context.request)).status).toBe(429)
    expect(context.dependencies.verifyFirebase).not.toHaveBeenCalled()
    expect(context.dependencies.repository.submit).not.toHaveBeenCalled()
  })

  it('distinguishes account verification from the completed security challenge', async () => {
    const auth = setup({ verifyFirebase: vi.fn().mockResolvedValue(null) })
    const captcha = setup({ verifyTurnstile: vi.fn().mockResolvedValue(false) })
    const authResponse = await auth.endpoint(auth.request)
    const captchaResponse = await captcha.endpoint(captcha.request)
    expect(authResponse.status).toBe(401)
    expect(captchaResponse.status).toBe(403)
    await expect(authResponse.json()).resolves.toMatchObject({ message: 'Sign in with a verified account and try again.' })
    await expect(captchaResponse.json()).resolves.toMatchObject({ message: 'Complete the security check again.' })
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

  it('accepts normal paragraph breaks in a server description', async () => {
    const context = setup({}, { ...validBody, description: 'Welcome to Liberty Troupe.\r\n\r\nJoin our friendly Flyff community.' })
    expect((await context.endpoint(context.request)).status).toBe(201)
    expect(context.dependencies.repository.submit).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Welcome to Liberty Troupe.\n\nJoin our friendly Flyff community.',
    }))
  })

  it('decodes and sanitizes an optional banner after identity and abuse checks', async () => {
    const context = setup()
    const pixels = new Uint8Array(468 * 60 * 4).fill(255)
    const png = new Uint8Array(UPNG.encode([pixels.buffer], 468, 60, 0))
    const parsed = new FormData()
    for (const [key, value] of Object.entries(validBody)) parsed.append(key, value)
    parsed.append('banner', new File([png], 'untrusted.bin', { type: 'application/octet-stream' }))
    parsed.append('bannerAltText', 'Moonlight Flyff colorful server banner')
    vi.spyOn(Response.prototype, 'formData').mockResolvedValue(parsed)
    const request = multipartRequest(png)
    const response = await context.endpoint(request)
    expect(response.status).toBe(201)
    expect(context.dependencies.repository.submit).toHaveBeenCalledWith(expect.objectContaining({
      banner: expect.objectContaining({ altText: 'Moonlight Flyff colorful server banner', image: expect.objectContaining({ mediaType: 'image/png' }) }),
    }))
    expect(context.dependencies.verifyFirebase).toHaveBeenCalledBefore(context.dependencies.repository.submit as ReturnType<typeof vi.fn>)
  })

  it('rejects malformed banner bytes without storing a partial submission', async () => {
    const context = setup()
    const parsed = new FormData()
    for (const [key, value] of Object.entries(validBody)) parsed.append(key, value)
    parsed.append('banner', new File([new Uint8Array([1, 2, 3])], 'banner.gif', { type: 'image/gif' }))
    parsed.append('bannerAltText', 'Moonlight Flyff colorful server banner')
    vi.spyOn(Response.prototype, 'formData').mockResolvedValue(parsed)
    const request = multipartRequest(new Uint8Array([1, 2, 3]))
    expect((await context.endpoint(request)).status).toBe(400)
    expect(context.dependencies.repository.submit).not.toHaveBeenCalled()
  })

  it('rejects actual multipart bytes above the limit even when Content-Length is forged', async () => {
    const context = setup()
    const request = multipartRequest(new Uint8Array(550_001), 100)
    expect((await context.endpoint(request)).status).toBe(400)
    expect(context.dependencies.verifyFirebase).not.toHaveBeenCalled()
    expect(context.dependencies.repository.submit).not.toHaveBeenCalled()
  })

  it('maps duplicate and unavailable-game results to user-safe errors', async () => {
    const duplicate = setup({ repository: { submit: vi.fn().mockResolvedValue({ outcome: 'duplicate' }) } })
    const unavailable = setup({ repository: { submit: vi.fn().mockResolvedValue({ outcome: 'game_unavailable' }) } })
    expect((await duplicate.endpoint(duplicate.request)).status).toBe(409)
    expect((await unavailable.endpoint(unavailable.request)).status).toBe(400)
  })

  it('maps a database banner constraint rejection to a user-safe field-compatible error', async () => {
    const context = setup({ repository: { submit: vi.fn().mockResolvedValue({ outcome: 'invalid_banner' }) } })
    const response = await context.endpoint(context.request)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ ok: false, message: 'Choose a valid 468 by 60 pixel GIF, PNG, or JPEG banner.' })
  })

  it.each([
    [{ ...validBody, gameSlug: 'Flyff' }],
    [{ ...validBody, website: 'http://moonlight.example' }],
    [{ ...validBody, website: 'https://user:secret@moonlight.example' }],
    [{ ...validBody, website: 'https://localhost/' }],
    [{ ...validBody, website: 'https://192.0.2.1/' }],
    [{ ...validBody, mode: 'unsafe' }],
    [{ ...validBody, extra: 'unexpected' }],
    [{ ...validBody, description: '' }],
    [{ ...validBody, description: 'Friendly server\u0000hidden data' }],
  ])('rejects malformed input before authentication', async (body) => {
    const context = setup({}, body)
    expect((await context.endpoint(context.request)).status).toBe(400)
    expect(context.dependencies.verifyFirebase).not.toHaveBeenCalled()
  })

  it.each(['https://moonlight.example/news', 'https://moonlight.example:8443/play?source=directory'])('accepts a valid HTTPS website with a path or custom port', async (website) => {
    const context = setup({}, { ...validBody, website })
    expect((await context.endpoint(context.request)).status).toBe(201)
    expect(context.dependencies.repository.submit).toHaveBeenCalledWith(expect.objectContaining({ website: new URL(website).href, websiteHost: 'moonlight.example' }))
  })

  it('sets Retry-After when rate limited', async () => {
    const context = setup({ rateLimit: vi.fn().mockResolvedValue({ success: false }) })
    expect((await context.endpoint(context.request)).headers.get('retry-after')).toBe('60')
  })
})
