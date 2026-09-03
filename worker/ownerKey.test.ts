import { describe, expect, it } from 'vitest'
import { deriveOwnerKey } from './ownerKey'

describe('owner key', () => {
  it('creates stable, secret-bound, domain-separated pseudonymous keys', async () => {
    const first = await deriveOwnerKey('secret-one', 'owner-one')
    expect(first).toHaveLength(32)
    expect(await deriveOwnerKey('secret-one', 'owner-one')).toEqual(first)
    expect(await deriveOwnerKey('secret-one', 'owner-two')).not.toEqual(first)
    expect(await deriveOwnerKey('secret-two', 'owner-one')).not.toEqual(first)
  })
})

