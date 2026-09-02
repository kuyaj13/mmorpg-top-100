import { submitProtectedVote } from './votingService'

describe('submitProtectedVote', () => {
  it('sends all three required proofs without putting them in the URL', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ votes: 4 })))
    await submitProtectedVote('https://api.example/', 'server/id', {
      idToken: 'identity-token', appCheckToken: 'app-check-token', turnstileToken: 'challenge-token',
    }, fetcher)

    const [requestUrl, init] = fetcher.mock.calls[0]
    expect(String(requestUrl)).toBe('https://api.example/api/servers/server%2Fid/votes')
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        authorization: 'Bearer identity-token',
        'content-type': 'application/json',
        'x-firebase-appcheck': 'app-check-token',
      },
      body: JSON.stringify({ turnstileToken: 'challenge-token' }),
    })
  })
})

