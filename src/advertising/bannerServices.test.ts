import { requestOwnerBannerWorkspace, uploadProtectedBanner } from './bannerServices'

describe('uploadProtectedBanner', () => {
  it('sends bounded raw image bytes with owner and app verification', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    const file = new File(['image'], 'banner.png', { type: 'image/png' })
    await uploadProtectedBanner('https://api.example/', { serverId: 'one', altText: 'A server banner image', file,turnstileToken:'challenge-token' }, { idToken: 'owner-token' }, fetcher)
    const [url, init] = fetcher.mock.calls[0]
    expect(String(url)).toBe('https://api.example/api/advertising/servers/one/banner')
    expect(init?.method).toBe('PUT')
    expect(init?.headers).toEqual({ authorization:'Bearer owner-token','x-turnstile-token':'challenge-token','x-banner-alt-text':'A%20server%20banner%20image','content-type':'image/png' })
    expect(init?.body).toBe(file)
  })
})

it('requests the owner workspace with a bearer token and no identity in the URL', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
  await requestOwnerBannerWorkspace('https://api.example/', 'owner-token', fetcher)
  const [url, init] = fetcher.mock.calls[0]
  expect(String(url)).toBe('https://api.example/api/advertising/owner-workspace')
  expect(init?.headers).toEqual({ authorization: 'Bearer owner-token' })
})
