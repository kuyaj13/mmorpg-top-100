import { validUuid } from './validation'

describe('validUuid', () => {
  it('accepts supported UUIDs and rejects malformed public input', () => {
    expect(validUuid('00000000-0000-4000-8000-000000000003')).toBe(true)
    expect(validUuid('not-a-uuid')).toBe(false)
    expect(validUuid('00000000-0000-0000-0000-000000000000')).toBe(false)
  })
})
