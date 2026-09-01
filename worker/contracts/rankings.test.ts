import { describe, expect, it } from 'vitest'
import { parseGameSlug } from './rankings'

describe('parseGameSlug', () => {
  it.each(['flyff', 'ragnarok-online', 'a1'])('accepts %s', (slug) => expect(parseGameSlug(slug)).toBe(slug))
  it.each(['', '-flyff', 'Flyff', 'flyff_', 'flyff--online', 'a'.repeat(101)])('rejects invalid value', (slug) => expect(parseGameSlug(slug)).toBeNull())
})
