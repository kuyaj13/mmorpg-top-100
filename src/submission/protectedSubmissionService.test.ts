import { submitProtectedServer } from './protectedSubmissionService'

describe('submitProtectedServer', () => {
  it('sends identity, App Check, and Turnstile proof to the protected endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ reference: 'SUB-1' })))
    await submitProtectedServer('https://api.example/', {
      name: 'Flyff One', website: 'https://flyff.example/', gameSlug: 'flyff', gameVersion: 'v22',
      region: 'Asia', mode: 'PvE', description: 'A community-focused Flyff server.', turnstileToken: 'challenge-token',
    }, { idToken: 'identity-token' }, fetcher)

    const [url, init] = fetcher.mock.calls[0]
    expect(String(url)).toBe('https://api.example/api/server-submissions')
    expect(init).toMatchObject({ method: 'POST', headers: {
      authorization: 'Bearer identity-token', 'content-type': 'application/json',
    } })
    expect(JSON.parse(String(init?.body))).toMatchObject({ gameSlug: 'flyff', turnstileToken: 'challenge-token' })
  })

  it('uses bounded multipart form data when a banner is included', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    const banner = new File([new Uint8Array([1, 2, 3])], 'banner.gif', { type: 'image/gif' })
    await submitProtectedServer('https://api.example/', {
      name: 'Flyff One', website: 'https://flyff.example/', gameSlug: 'flyff', gameVersion: 'v22', region: 'Asia',
      mode: 'PvE', description: 'A community-focused Flyff server.', turnstileToken: 'challenge-token', banner,
      bannerAltText: 'Flyff One server banner',
    }, { idToken: 'identity-token' }, fetcher)
    const init = fetcher.mock.calls[0][1]
    expect(init?.headers).toEqual({ authorization: 'Bearer identity-token' })
    expect(init?.body).toBeInstanceOf(FormData)
    const body = init?.body
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('banner')).toBe(banner)
    expect((body as FormData).get('turnstileToken')).toBe('challenge-token')
  })
})
