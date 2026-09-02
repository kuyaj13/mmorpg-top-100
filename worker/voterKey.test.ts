import { describe, expect, it } from 'vitest'
import { deriveVoterKey } from './voterKey'

describe('voter key', () => {
  it('creates stable, secret-bound 32-byte pseudonymous keys', async () => {
    const first = await deriveVoterKey('secret-one', 'user-one')
    expect(first).toHaveLength(32)
    expect(await deriveVoterKey('secret-one', 'user-one')).toEqual(first)
    expect(await deriveVoterKey('secret-one', 'user-two')).not.toEqual(first)
    expect(await deriveVoterKey('secret-two', 'user-one')).not.toEqual(first)
  })
})

