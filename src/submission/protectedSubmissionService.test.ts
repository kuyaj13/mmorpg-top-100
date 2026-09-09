import { publicSubmissionFailure, submitProtectedServer } from './protectedSubmissionService'

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

describe('public submission failures', () => {
  it('maps a rejected banner to a visible banner-field error', () => {
    expect(publicSubmissionFailure(400, 'Choose a valid 468 by 60 pixel GIF, PNG, or JPEG banner.')).toEqual({
      ok: false,
      message: 'Choose a valid 468 by 60 pixel GIF, PNG, or JPEG banner.',
      fieldErrors: { banner: 'Choose a valid 468 by 60 pixel GIF, PNG, or JPEG banner.' },
    })
  })

  it('does not blame the security-check field for an account-token failure', () => {
    expect(publicSubmissionFailure(401)).toEqual({ ok: false, message: 'Your account could not be verified. Sign out, then sign in with your verified account and try again.' })
  })

  it('maps an actual security-check failure to its field', () => {
    expect(publicSubmissionFailure(403)).toMatchObject({ fieldErrors: { turnstileToken: 'Complete the security check again.' } })
  })

  it('shows only a validated support reference for an unexpected server failure', () => {
    const reference = '123e4567-e89b-42d3-a456-426614174000'
    expect(publicSubmissionFailure(500, undefined, reference).message).toBe(`Your server could not be submitted. Please try again. Support reference: ${reference}`)
    expect(publicSubmissionFailure(500, undefined, '<script>alert(1)</script>').message).toBe('Your server could not be submitted. Please try again.')
  })
})
