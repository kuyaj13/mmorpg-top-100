import { useEffect, useState } from 'react'
import logoUrl from '../assets/mmorpg-top-100-logo-web.png'
import { siteConfig } from '../config/site'
import './GamePage.css'
import { findGameBySlug } from './games'
import { rankingsService as defaultRankingsService } from './rankingsService'
import type { PublicRankingServer, RankingsService } from './rankingsService'

type GamePageProps = { slug: string; rankingsService?: RankingsService }

const bannerPreviews: Record<string, { animated: string; static: string; alt: string }> = {
  'flyff:Prologic Flyff': {
    animated: '/banners/prologic-flyff-preview.gif',
    static: '/banners/prologic-flyff-preview-static.png',
    alt: 'Prologic Flyff banner with its gold logo over a blue and pink cloudscape',
  },
}

export default function GamePage({ slug, rankingsService = defaultRankingsService }: GamePageProps) {
  const game = findGameBySlug(slug)
  const [servers, setServers] = useState<PublicRankingServer[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selectedId, setSelectedId] = useState('')

  useEffect(() => {
    if (!game) return
    const controller = new AbortController()
    let active = true
    rankingsService.getGameRankings(game.slug, controller.signal).then(
      (rankings) => {
        if (!active) return
        setServers(rankings.game.slug === game.slug ? rankings.servers : [])
        setSelectedId('')
        setStatus('ready')
      },
      () => { if (active) setStatus('error') },
    )
    return () => { active = false; controller.abort() }
  }, [game, rankingsService])

  const selectedServer = servers.find((server) => server.id === selectedId) ?? servers[0]
  const selectedBanner = selectedServer ? bannerPreviews[`${game?.slug}:${selectedServer.name}`] : undefined

  if (!game) return (
    <div className="game-page">
      <a className="skip-link" href="#game-main">Skip to main content</a>
      <header className="game-header"><a className="game-logo-link" href="/" aria-label="MMORPG Top 100 home"><img src={logoUrl} alt="MMORPG Top 100" /></a></header>
      <main id="game-main" className="game-not-found"><a href="/">Back to game directory</a><h1>Game not found</h1><p>This game is not currently supported.</p></main>
    </div>
  )

  return (
    <div className="game-page">
      <a className="skip-link" href="#game-main">Skip to main content</a>
      <header className="game-header">
        <a className="game-logo-link" href="/" aria-label="MMORPG Top 100 home"><img src={logoUrl} alt="MMORPG Top 100" /></a>
        <a href="/#games">All games</a>
      </header>
      <main id="game-main">
        <section className="game-intro">
          <p className="eyebrow">{game.type}</p><h1>{game.name} private server rankings</h1>
          <p>Explore community-ranked {game.name} servers. Rankings on this page are independent from every other game.</p>
        </section>
        <section className="exclusive-servers" aria-labelledby="exclusive-heading">
          <div><p className="eyebrow">Advertisement</p><h2 id="exclusive-heading">Exclusive {game.name} servers</h2></div>
          <p role="status">There are no active sponsored servers for this game.</p>
        </section>
        <section className="game-rankings" aria-labelledby="rankings-heading">
          <div className="game-ranking-heading"><div><p className="eyebrow">Organic ranking</p><h2 id="rankings-heading">{game.name} Top 100</h2></div></div>
          {status === 'loading' && <p role="status">Loading {game.name} rankings...</p>}
          {status === 'error' && <p role="alert">Rankings are unavailable right now. Please try again later.</p>}
          {status === 'ready' && servers.length === 0 && <p role="status">There are no approved {game.name} servers yet.</p>}
          {status === 'ready' && servers.length > 0 && (
            <div className="game-ranking-layout">
              <ol className="game-server-list" aria-label={`${game.name} server rankings`}>
                {servers.map((server) => <li key={server.id}><button type="button" aria-pressed={selectedServer?.id === server.id} onClick={() => setSelectedId(server.id)}>
                  <span>{server.name}</span><span>{server.votes.toLocaleString()} votes</span>
                </button></li>)}
              </ol>
              {selectedServer && <aside className="game-server-detail" aria-label="Selected server details">
                {selectedBanner && <figure className="server-banner-preview">
                  <picture>
                    <source media="(prefers-reduced-motion: reduce)" srcSet={selectedBanner.static} />
                    <img src={selectedBanner.animated} alt={selectedBanner.alt} width="468" height="60" />
                  </picture>
                  <figcaption>Sample banner preview</figcaption>
                </figure>}
                <h3>{selectedServer.name}</h3>
                <dl><div><dt>Votes</dt><dd>{selectedServer.votes.toLocaleString()}</dd></div></dl>
                {!siteConfig.votingEnabled && <p role="status">Voting will open after the secure voting service is ready.</p>}
                <p className="visually-hidden" role="status" aria-atomic="true">Selected {selectedServer.name}.</p>
              </aside>}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
