import { readFileSync } from 'node:fs'

describe('hosting security headers', () => {
  it.each(['public/_headers', 'firebase.json'])('allows approved API-hosted banners in %s', (path) => {
    const configuration = readFileSync(path, 'utf8')
    expect(configuration).toMatch(/img-src[^;]*https:\/\/api\.mmorpgtop100\.com/)
  })
})
