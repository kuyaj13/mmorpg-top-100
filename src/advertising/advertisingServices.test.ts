import { publicClaimError,requestAdvertisingWorkspace,submitProtectedClaim } from './advertisingServices'

it('loads advertising data only through the authenticated Worker API',async()=>{const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({ok:true,servers:[],packages:[],claims:[]}));await requestAdvertisingWorkspace('https://api.mmorpgtop100.com','firebase-id-token',fetcher);expect(fetcher).toHaveBeenCalledWith(new URL('https://api.mmorpgtop100.com/api/advertising/workspace'),{cache:'no-store',headers:{authorization:'Bearer firebase-id-token'}})})

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

it('maps security and duplicate failures to the correct claim fields',()=>{expect(publicClaimError(403,'Complete the security check again.')).toMatchObject({fieldErrors:{turnstileToken:'Complete the security check again.'}});expect(publicClaimError(409,'This PayPal transaction reference has already been used.')).toMatchObject({fieldErrors:{donorReference:'Enter a different PayPal transaction reference.'}})})
