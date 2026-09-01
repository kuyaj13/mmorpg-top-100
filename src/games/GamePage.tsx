import { useEffect, useMemo, useState } from 'react'
import { catalogService as defaultCatalogService } from '../catalog/catalogService'
import type { CatalogService, Server, VotingService } from '../catalog/types'
import { votingService as defaultVotingService } from '../catalog/votingService'
import { findGameBySlug } from './games'
import './GamePage.css'
import logoUrl from '../assets/mmorpg-top-100-logo-web.png'
import { siteConfig } from '../config/site'

type GamePageProps = {
  slug: string
  catalogService?: CatalogService
  votingService?: VotingService
}

export default function GamePage({
  slug,
  catalogService = defaultCatalogService,
  votingService = defaultVotingService,
}: GamePageProps) {
  const game = findGameBySlug(slug)
  const [servers, setServers] = useState<Server[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [sortBy, setSortBy] = useState<'votes' | 'players' | 'rating'>('votes')
  const [selectedId, setSelectedId] = useState('')
  const [pendingVoteId, setPendingVoteId] = useState('')
  const [voteFeedback, setVoteFeedback] = useState('')

  useEffect(() => {
    if (!game) return
    let active = true
    catalogService.listServers(game.slug).then(
      (items) => {
        if (!active) return
        setServers(items.filter((server) => server.gameSlug === game.slug))
        setStatus('ready')
      },
      () => {
        if (active) setStatus('error')
      },
    )
    return () => {
      active = false
    }
  }, [catalogService, game])

  const rankedServers = useMemo(
    () =>
      [...servers].sort((a, b) => {
        if (sortBy === 'players') return b.players - a.players
        if (sortBy === 'rating') return b.rating - a.rating
        return b.votes - a.votes
      }),
    [servers, sortBy],
  )
  const selectedServer = rankedServers.find((server) => server.id === selectedId) ?? rankedServers[0]

  if (!game) {
    return (
      <div className="game-page">
        <a className="skip-link" href="#game-main">Skip to main content</a>
        <header className="game-header">
          <a className="game-logo-link" href="/" aria-label="MMORPG Top 100 home">
            <img src={logoUrl} alt="MMORPG Top 100" />
          </a>
        </header>
        <main id="game-main" className="game-not-found">
          <a href="/">Back to game directory</a>
          <h1>Game not found</h1>
          <p>This game is not currently supported.</p>
        </main>
      </div>
    )
  }

  const vote = async (server: Server) => {
    setPendingVoteId(server.id)
    setVoteFeedback('')
    try {
      const result = await votingService.voteForServer(server.id)
      if (result.ok) {
        setServers((items) =>
          items.map((item) => (item.id === server.id ? { ...item, votes: result.votes } : item)),
        )
        setVoteFeedback('Your vote has been recorded.')
      } else setVoteFeedback(result.message)
    } catch {
      setVoteFeedback('Your vote could not be recorded. Please try again.')
    } finally {
      setPendingVoteId('')
    }
  }

  return (
    <div className="game-page">
      <a className="skip-link" href="#game-main">Skip to main content</a>
      <header className="game-header">
        <a className="game-logo-link" href="/" aria-label="MMORPG Top 100 home">
          <img src={logoUrl} alt="MMORPG Top 100" />
        </a>
        <a href="/#games">All games</a>
      </header>
      <main id="game-main">
        <section className="game-intro">
          <p className="eyebrow">{game.type}</p>
          <h1>{game.name} private server rankings</h1>
          <p>Explore community-ranked {game.name} servers. Rankings on this page are independent from every other game.</p>
        </section>

        <section className="exclusive-servers" aria-labelledby="exclusive-heading">
          <div>
            <p className="eyebrow">Advertisement</p>
            <h2 id="exclusive-heading">Exclusive {game.name} servers</h2>
          </div>
          <p role="status">There are no active sponsored servers for this game.</p>
        </section>

        <section className="game-rankings" aria-labelledby="rankings-heading">
          <div className="game-ranking-heading">
            <div>
              <p className="eyebrow">Organic ranking</p>
              <h2 id="rankings-heading">{game.name} Top 100</h2>
            </div>
            <label>
              Sort by
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
                <option value="votes">Votes</option>
                <option value="players">Players</option>
                <option value="rating">Rating</option>
              </select>
            </label>
          </div>
          <p className="visually-hidden" role="status" aria-atomic="true">
            Rankings sorted by {sortBy}.
          </p>

          {status === 'loading' && <p role="status">Loading {game.name} rankings...</p>}
          {status === 'error' && <p role="alert">Rankings are unavailable right now. Please try again later.</p>}
          {status === 'ready' && rankedServers.length === 0 && <p role="status">There are no approved {game.name} servers yet.</p>}
          {status === 'ready' && rankedServers.length > 0 && (
            <div className="game-ranking-layout">
              <ol className="game-server-list" aria-label={`${game.name} server rankings`}>
                {rankedServers.slice(0, 100).map((server) => (
                  <li key={server.id}>
                    <button type="button" aria-pressed={selectedServer?.id === server.id} onClick={() => setSelectedId(server.id)}>
                      <span>{server.name}</span>
                      <span>{server.votes.toLocaleString()} votes</span>
                    </button>
                  </li>
                ))}
              </ol>
              {selectedServer && (
                <aside className="game-server-detail" aria-label="Selected server details">
                  <h3>{selectedServer.name}</h3>
                  <p>{selectedServer.description}</p>
                  <dl>
                    <div><dt>Players</dt><dd>{selectedServer.players.toLocaleString()}</dd></div>
                    <div><dt>Votes</dt><dd>{selectedServer.votes.toLocaleString()}</dd></div>
                    <div><dt>Rating</dt><dd>{selectedServer.rating.toFixed(1)}</dd></div>
                    <div><dt>Region</dt><dd>{selectedServer.region}</dd></div>
                  </dl>
                  {siteConfig.votingEnabled ? (
                    <button type="button" disabled={pendingVoteId === selectedServer.id} onClick={() => void vote(selectedServer)}>
                      {pendingVoteId === selectedServer.id ? 'Recording vote...' : `Vote for ${selectedServer.name}`}
                    </button>
                  ) : (
                    <p role="status">Voting will open after the secure voting service is ready.</p>
                  )}
                  <p className="visually-hidden" role="status" aria-atomic="true">
                    {voteFeedback || `Selected ${selectedServer.name}.`}
                  </p>
                </aside>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
