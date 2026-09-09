import { parseAdPlacements, readDecisionResult, requestAdPlacement } from './adPlacementService'

const placement = {
  id: 'placement-1', serverName: 'Flyff One', website: 'https://flyff.example/',
  gameSlug: 'flyff', gameName: 'Flyff', durationDays: 30, status: 'active',
  startsAt: '2026-09-01T00:00:00Z', expiresAt: '2026-10-01T00:00:00Z',
  queuedAt: '2026-08-31T00:00:00Z', bannerStatus: 'approved', claimStatus: 'verified', impressionCount: 12,
}

describe('advertisement placement API boundary', () => {
  it('sends administrator credentials in the header when listing placements', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    await requestAdPlacement('https://api.example/', '/api/admin/ad-placements', 'admin-token', undefined, fetcher)

    const [url, init] = fetcher.mock.calls[0]
    expect(String(url)).toBe('https://api.example/api/admin/ad-placements')
    expect(init).toEqual({ method: 'GET', headers: { authorization: 'Bearer admin-token' }, body: undefined })
  })

  it('sends only the decision and a fresh operation identifier', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'))
    await requestAdPlacement('https://api.example/', '/api/admin/ad-placements/placement-1/decision', 'fresh-token', 'suspend', fetcher)

    const [url, init] = fetcher.mock.calls[0]
    expect(String(url)).toBe('https://api.example/api/admin/ad-placements/placement-1/decision')
    expect(init?.method).toBe('POST')
    expect(init?.headers).toEqual({ authorization: 'Bearer fresh-token', 'content-type': 'application/json' })
    expect(JSON.parse(String(init?.body))).toEqual({ decision: 'suspend', operationId: expect.any(String) })
  })

  it('accepts only bounded HTTPS placement records with supported durations', () => {
    expect(parseAdPlacements({ placements: [placement] })).toEqual([placement])
    expect(() => parseAdPlacements({ placements: [{ ...placement, website: 'javascript:alert(1)' }] })).toThrow()
    expect(() => parseAdPlacements({ placements: [{ ...placement, durationDays: 365 }] })).toThrow()
    expect(() => parseAdPlacements({ placements: [{ ...placement, queuedAt: 'not-a-date' }] })).toThrow()
    expect(() => parseAdPlacements({ placements: [{ ...placement, impressionCount: -1 }] })).toThrow()
    expect(() => parseAdPlacements({ placements: [{ ...placement, unexpected: true }] })).toThrow()
  })

  it('does not expose unexpected API details in administrator feedback', async () => {
    await expect(readDecisionResult(Response.json({ message: 'SQL function failed at line 12' }, { status: 500 })))
      .resolves.toEqual({ ok: false, message: 'The advertisement decision could not be saved.' })
    await expect(readDecisionResult(Response.json({ message: 'This game currently has no available advertising position.' }, { status: 409 })))
      .resolves.toEqual({ ok: false, message: 'This game currently has no available advertising position.' })
  })
})
