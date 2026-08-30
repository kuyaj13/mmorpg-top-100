import { ClaimConflictError, ClaimDetailsError, insertDonationClaim, type TransactionClient } from './donationClaimsRepository'

function input() {
  return { claimId: '00000000-0000-4000-8000-000000000001', eventId: '00000000-0000-4000-8000-000000000002', advertiserUid: 'owner-1', serverId: '00000000-0000-4000-8000-000000000003', packageCode: 'exclusive_7_day', donorReference: 'PAYPAL123456', createdAt: '2026-08-30T00:00:00.000Z' }
}

function client(rowCounts: number[] = [1, 1]) {
  const queries: string[] = []
  let selection = 0
  const value: TransactionClient = { query: async (text) => {
    queries.push(text)
    if (text.startsWith('SELECT')) return { rowCount: rowCounts[selection++] ?? 0 }
    return { rowCount: 1 }
  } }
  return { value, queries }
}

describe('insertDonationClaim', () => {
  it('validates ownership and package eligibility and commits claim plus audit atomically', async () => {
    const database = client()
    await insertDonationClaim(database.value, input())
    expect(database.queries).toEqual([
      'BEGIN',
      expect.stringContaining('FROM public.server'),
      expect.stringContaining('FROM public.ad_package'),
      expect.stringContaining('INSERT INTO public.donation_claim '),
      expect.stringContaining('INSERT INTO public.donation_review_event '),
      'COMMIT',
    ])
  })

  it('rolls back when the server is not active and owned by the caller', async () => {
    const database = client([0, 1])
    await expect(insertDonationClaim(database.value, input())).rejects.toBeInstanceOf(ClaimDetailsError)
    expect(database.queries.at(-1)).toBe('ROLLBACK')
    expect(database.queries.some((query) => query.includes('INSERT INTO public.donation_claim '))).toBe(false)
  })

  it('maps a duplicate donor reference and rolls back', async () => {
    const database = client()
    database.value.query = async (text) => {
      database.queries.push(text)
      if (text.startsWith('SELECT')) return { rowCount: 1 }
      if (text.includes('INSERT INTO public.donation_claim ')) throw { code: '23505' }
      return { rowCount: 1 }
    }
    await expect(insertDonationClaim(database.value, input())).rejects.toBeInstanceOf(ClaimConflictError)
    expect(database.queries.at(-1)).toBe('ROLLBACK')
  })

  it('rolls back the claim when the submission audit cannot be inserted', async () => {
    const database = client()
    const originalQuery = database.value.query
    database.value.query = async (text, values) => {
      if (text.includes('INSERT INTO public.donation_review_event ')) {
        database.queries.push(text)
        throw new Error('audit unavailable')
      }
      return originalQuery(text, values)
    }
    await expect(insertDonationClaim(database.value, input())).rejects.toThrow('audit unavailable')
    expect(database.queries.at(-1)).toBe('ROLLBACK')
    expect(database.queries).not.toContain('COMMIT')
  })

  it('preserves the original conflict when rollback also fails', async () => {
    const database = client()
    database.value.query = async (text) => {
      database.queries.push(text)
      if (text.startsWith('SELECT')) return { rowCount: 1 }
      if (text.includes('INSERT INTO public.donation_claim ')) throw { code: '23505' }
      if (text === 'ROLLBACK') throw new Error('connection lost')
      return { rowCount: 1 }
    }
    await expect(insertDonationClaim(database.value, input())).rejects.toBeInstanceOf(ClaimConflictError)
    expect(database.queries.at(-1)).toBe('ROLLBACK')
  })
})
