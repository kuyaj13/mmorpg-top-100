import { games } from '../games/games'
import { createSitemap } from './sitemap'

describe('search sitemap', () => {
  it('contains each canonical public route exactly once', () => {
    const sitemap = createSitemap()
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
    expect(locations).toHaveLength(games.length + 2)
    expect(new Set(locations).size).toBe(locations.length)
    expect(locations).toContain('https://mmorpgtop100.com/')
    expect(locations).toContain('https://mmorpgtop100.com/submit')
    for (const game of games) expect(locations).toContain(`https://mmorpgtop100.com/games/${game.slug}`)
  })
})
