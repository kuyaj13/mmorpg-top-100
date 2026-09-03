import { requestAdminModeration } from './adminModerationApiService'

describe('requestAdminModeration', () => {
  it('sends the administrator token when listing pending submissions', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    await requestAdminModeration('https://api.example/', '/api/admin/server-submissions', 'admin-token', undefined, fetcher)
    expect(fetcher).toHaveBeenCalledWith(new URL('https://api.example/api/admin/server-submissions'), expect.objectContaining({
      method: 'GET', headers: { authorization: 'Bearer admin-token' },
    }))
  })

  it('encodes a decision in the body and keeps it out of the URL', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    await requestAdminModeration('https://api.example/', '/api/admin/server-submissions/submission%2Fone', 'admin-token', 'reject', fetcher)
    const [url, init] = fetcher.mock.calls[0]
    expect(String(url)).toBe('https://api.example/api/admin/server-submissions/submission%2Fone')
    expect(init).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(init?.body))).toMatchObject({ decision: 'reject', reasonCode: 'other', operationId: expect.any(String) })
  })
})
