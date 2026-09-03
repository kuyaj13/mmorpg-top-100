import { uploadProtectedBanner } from './bannerServices'

describe('uploadProtectedBanner', () => {
  it('sends the file with verified owner identity without overriding multipart content type', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    const file = new File(['image'], 'banner.png', { type: 'image/png' })
    await uploadProtectedBanner('https://api.example/', { serverId: 'one', altText: 'A server banner image', file }, { idToken: 'owner-token' }, fetcher)
    const [url, init] = fetcher.mock.calls[0]
    expect(String(url)).toBe('https://api.example/api/advertising/banners')
    expect(init?.headers).toEqual({ authorization: 'Bearer owner-token' })
    expect(init?.body).toBeInstanceOf(FormData)
  })
})
