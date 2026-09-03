import { submitProtectedClaim } from './advertisingServices'

describe('submitProtectedClaim', () => {
  it('sends claim mutations only to the protected API with identity and Turnstile proof', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true }, { status: 201 }))
    const input = {
      serverId: 'server-1',
      packageCode: 'exclusive_7_day',
      donorReference: 'PAYPAL123456',
      turnstileToken: 'turnstile-token',
    }

    await submitProtectedClaim(
      'https://api.mmorpgtop100.com',
      { idToken: 'firebase-id-token' },
      input,
      fetcher,
    )

    expect(fetcher).toHaveBeenCalledOnce()
    const [url, options] = fetcher.mock.calls[0]
    expect(String(url)).toBe('https://api.mmorpgtop100.com/api/advertising/claims')
    expect(options).toMatchObject({
      method: 'POST',
      headers: {
        authorization: 'Bearer firebase-id-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    })
  })
})
