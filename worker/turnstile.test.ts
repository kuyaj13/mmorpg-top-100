import { describe, expect, it, vi } from 'vitest'
import { createTurnstileVerifier } from './turnstile'

describe('Turnstile verifier', () => {
  it('requires success, exact hostname, and exact action', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true, hostname: 'www.mmorpgtop100.com', action: 'vote' }))
    const verify = createTurnstileVerifier('secret', 'mmorpgtop100.com,www.mmorpgtop100.com', 'vote', fetcher)
    await expect(verify('token', '192.0.2.1')).resolves.toBe(true)
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('siteverify'), expect.objectContaining({ method: 'POST' }))
  })

  it('rejects hostname suffix attacks outside the explicit allowlist', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true, hostname: 'www.mmorpgtop100.com.evil.test', action: 'vote' }))
    await expect(createTurnstileVerifier('secret', 'mmorpgtop100.com,www.mmorpgtop100.com', 'vote', fetcher)('token')).resolves.toBe(false)
  })

  it('fails closed for mismatches and service failures', async () => {
    const mismatch = createTurnstileVerifier('secret', 'mmorpgtop100.com', 'vote', vi.fn().mockResolvedValue(Response.json({ success: true, hostname: 'evil.test', action: 'vote' })))
    const failure = createTurnstileVerifier('secret', 'mmorpgtop100.com', 'vote', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(mismatch('token')).resolves.toBe(false)
    await expect(failure('token')).resolves.toBe(false)
  })
})
