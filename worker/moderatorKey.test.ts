import { expect, it } from 'vitest'
import { deriveModeratorKey } from './moderatorKey'
it('derives stable domain-separated moderator keys', async () => {
  const key = await deriveModeratorKey('secret', 'admin'); expect(key).toHaveLength(32)
  expect(await deriveModeratorKey('secret', 'admin')).toEqual(key)
  expect(await deriveModeratorKey('secret', 'other')).not.toEqual(key)
})

