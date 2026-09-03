import { requestDonationReview } from './adminServices'

describe('requestDonationReview', () => {
  it('does not send browser-provided amount or currency when verifying a claim', async () => {
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(Response.json({ok:true}))
    await requestDonationReview('https://api.mmorpgtop100.com','/api/admin/donation-claims/claim-1/decision','admin-token','verify',undefined,fetcher)
    const [,options]=fetcher.mock.calls[0]
    const body=JSON.parse(String(options?.body)) as Record<string,unknown>
    expect(body).toMatchObject({decision:'verify'})
    expect(body.operationId).toEqual(expect.any(String))
    expect(body).not.toHaveProperty('verifiedAmountMinor')
    expect(body).not.toHaveProperty('currency')
  })
})
