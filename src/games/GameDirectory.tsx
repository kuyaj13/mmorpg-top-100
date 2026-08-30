import { games } from './games'
import type { GameType } from './games'

const gameTypes: GameType[] = ['MMORPG', 'STRATEGY', 'RPG', 'GENERAL', 'FPS', 'CONSOLE']

export default function GameDirectory() {
  return (
    <section id="games" className="game-directory" aria-labelledby="game-directory-heading">
      <p className="eyebrow">Game directory</p>
      <h2 id="game-directory-heading">Browse rankings by game</h2>
      <p>Each game has an independent ranking and sponsored section.</p>
      <div className="game-groups">
        {gameTypes.map((type) => {
          const matchingGames = games.filter((game) => game.type === type)
          return (
            <details key={type} open={type === 'MMORPG'}>
              <summary>{type} ({matchingGames.length})</summary>
              <ul>
                {matchingGames.map((game) => (
                  <li key={game.slug}>
                    <a href={`/games/${game.slug}`}>{game.name}</a>
                  </li>
                ))}
              </ul>
            </details>
          )
        })}
      </div>
    </section>
  )
}
