import { requestBannerReview } from './bannerReviewApiService'

describe('requestBannerReview', () => {
  it('requests the protected pending list without exposing credentials in the URL', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'))
    await requestBannerReview('https://api.example/', '/api/admin/banners', 'admin-token', undefined, fetcher)
    const [url, init] = fetcher.mock.calls[0]
    expect(String(url)).toBe('https://api.example/api/admin/banners')
    expect(init).toEqual({ method: 'GET', headers: { authorization: 'Bearer admin-token' }, body: undefined })
  })

  it('sends an idempotent decision with a fresh operation identifier', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'))
    await requestBannerReview('https://api.example/', '/api/admin/banners/banner-1/decision', 'fresh-token', 'reject', fetcher)
    const [, init] = fetcher.mock.calls[0]
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ authorization: 'Bearer fresh-token', 'content-type': 'application/json' })
    expect(JSON.parse(init.body)).toMatchObject({ decision: 'reject', operationId: expect.any(String) })
  })
})
