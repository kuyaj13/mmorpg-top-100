import { uploadProtectedBanner } from './bannerServices'

describe('uploadProtectedBanner', () => {
  it('sends bounded raw image bytes with owner and app verification', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    const file = new File(['image'], 'banner.png', { type: 'image/png' })
    await uploadProtectedBanner('https://api.example/', { serverId: 'one', altText: 'A server banner image', file }, { idToken: 'owner-token',appCheckToken:'app-token' }, fetcher)
    const [url, init] = fetcher.mock.calls[0]
    expect(String(url)).toBe('https://api.example/api/advertising/servers/one/banner')
    expect(init?.method).toBe('PUT')
    expect(init?.headers).toEqual({ authorization:'Bearer owner-token','x-firebase-appcheck':'app-token','x-banner-alt-text':'A server banner image','content-type':'image/png' })
    expect(init?.body).toBe(file)
  })
})
