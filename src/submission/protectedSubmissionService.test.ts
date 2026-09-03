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
})
