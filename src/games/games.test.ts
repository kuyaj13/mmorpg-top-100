import { games } from './games'

describe('game catalog', () => {
  it('contains unique names and stable slugs', () => {
    expect(new Set(games.map((game) => game.name)).size).toBe(games.length)
    expect(new Set(games.map((game) => game.slug)).size).toBe(games.length)
  })

  it('preserves the supplied game-type classifications', () => {
    expect(games).toHaveLength(82)
    expect(games.filter((game) => game.type === 'MMORPG')).toHaveLength(63)
    expect(games.filter((game) => game.type === 'STRATEGY')).toHaveLength(3)
    expect(games.filter((game) => game.type === 'RPG')).toHaveLength(1)
    expect(games.filter((game) => game.type === 'GENERAL')).toHaveLength(5)
    expect(games.filter((game) => game.type === 'FPS')).toHaveLength(7)
    expect(games.filter((game) => game.type === 'CONSOLE')).toHaveLength(3)
  })
})
