import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { votingService as defaultVotingService } from './catalog/votingService'
import type { CatalogService, Server, VotingService } from './catalog/types'
import { submissionService as defaultSubmissionService } from './submission/submissionService'
import type { ServerSubmission, SubmissionService } from './submission/types'
import GameDirectory from './games/GameDirectory'
import { siteConfig } from './config/site'
import logoUrl from './assets/mmorpg-top-100-logo-web.png'
import ApprovedServersSection from './home/ApprovedServersSection'
import type { ApprovedServersService } from './home/approvedServersService'

const emptyServer: Server = {
  id: 'catalog-placeholder',
  gameSlug: 'unavailable',
  name: 'Server catalog',
  players: 0,
  votes: 0,
  region: 'Not available',
  mode: 'RPG',
  rating: 0,
  description: 'Server details will appear when the catalog is available.',
  status: 'Stable',
  trend: '—',
}

const perks = [
  'Player-driven rankings',
  'Verified private server listings',
  'Mobile-friendly browsing',
  'Easy submission and review',
]

const packages = [
  {
    name: 'Exclusive 7-day',
    price: '$10',
    period: '/7 days',
    summary: 'A one-week sponsored placement for one approved game server.',
    features: ['Game-specific rotation', 'Sponsored label', 'Manual approval'],
  },
  {
    name: 'Exclusive 30-day',
    price: '$20',
    period: '/30 days',
    summary: 'A full-month sponsored placement for one approved game server.',
    features: ['Game-specific rotation', 'Sponsored label', 'Manual approval'],
    highlighted: true,
  },
]

type AppProps = {
  catalogService?: CatalogService
  approvedServersService?: ApprovedServersService
  votingService?: VotingService
  submissionService?: SubmissionService
}

function App({
  catalogService,
  approvedServersService,
  votingService = defaultVotingService,
  submissionService = defaultSubmissionService,
}: AppProps) {
  const samplePreview = catalogService !== undefined
  const [servers, setServers] = useState<Server[]>([])
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selectedMode, setSelectedMode] = useState<'All' | Server['mode']>('All')
  const [sortBy, setSortBy] = useState<'votes' | 'players' | 'rating'>('votes')
  const [selectedServerId, setSelectedServerId] = useState('')
  const [pendingVoteId, setPendingVoteId] = useState('')
  const [votedServerIds, setVotedServerIds] = useState<Set<string>>(() => new Set())
  const [voteFeedback, setVoteFeedback] = useState<Record<string, string>>({})
  const [submissionPending, setSubmissionPending] = useState(false)
  const [submissionErrors, setSubmissionErrors] = useState<Record<string, string>>({})
  const [submissionFeedback, setSubmissionFeedback] = useState('')

  useEffect(() => {
    if (!catalogService) {
      return
    }
    let active = true

    catalogService.listServers().then(
      (catalogServers) => {
        if (active) {
          setServers(catalogServers)
          setCatalogStatus('ready')
        }
      },
      () => {
        if (active) {
          setCatalogStatus('error')
        }
      },
    )

    return () => {
      active = false
    }
  }, [catalogService])

  const filteredServers = useMemo(() => {
    const filtered =
      selectedMode === 'All'
        ? [...servers]
        : servers.filter((server) => server.mode === selectedMode)

    return filtered.sort((a, b) => {
      if (sortBy === 'players') {
        return b.players - a.players
      }

      if (sortBy === 'rating') {
        return b.rating - a.rating
      }

      return b.votes - a.votes
    })
  }, [selectedMode, sortBy, servers])

  const selectedServer =
    filteredServers.find((server) => server.id === selectedServerId) ?? filteredServers[0]
  const effectiveSelectedServerId = selectedServer?.id ?? ''
  const displayServer = selectedServer ?? emptyServer

  const handleVote = async (serverId: string) => {
    setPendingVoteId(serverId)
    try {
      const result = await votingService.voteForServer(serverId)

      if (result.ok) {
        setServers((currentServers) =>
          currentServers.map((server) =>
            server.id === serverId ? { ...server, votes: result.votes } : server,
          ),
        )
        setVotedServerIds((currentIds) => new Set(currentIds).add(serverId))
        setVoteFeedback((currentFeedback) => ({
          ...currentFeedback,
          [serverId]: 'Your vote has been recorded.',
        }))
      } else {
        setVoteFeedback((currentFeedback) => ({
          ...currentFeedback,
          [serverId]: result.message,
        }))
      }
    } catch {
      setVoteFeedback((currentFeedback) => ({
        ...currentFeedback,
        [serverId]: 'Your vote could not be recorded. Please try again.',
      }))
    } finally {
      setPendingVoteId('')
    }
  }

  const handleSubmission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const submission: ServerSubmission = {
      name: String(data.get('name') ?? '').trim(),
      website: String(data.get('website') ?? '').trim(),
      gameVersion: String(data.get('gameVersion') ?? '').trim(),
      region: String(data.get('region') ?? '').trim(),
      mode: String(data.get('mode') ?? 'PvE') as Server['mode'],
      description: String(data.get('description') ?? '').trim(),
    }
    const errors: Record<string, string> = {}

    if (!submission.name) errors.name = 'This field is required.'
    if (!submission.gameVersion) errors.gameVersion = 'This field is required.'
    if (!submission.region) errors.region = 'This field is required.'
    if (!submission.description) errors.description = 'This field is required.'

    try {
      const website = new URL(submission.website)
      if (website.protocol !== 'https:') errors.website = 'Please enter a secure server URL.'
    } catch {
      errors.website = 'Please enter a valid server URL.'
    }

    setSubmissionErrors(errors)
    setSubmissionFeedback('')
    if (Object.keys(errors).length > 0) return

    setSubmissionPending(true)
    try {
      const result = await submissionService.submitServer(submission)
      if (result.ok) {
        setSubmissionFeedback('Your server has been submitted for review.')
        form.reset()
      } else {
        setSubmissionFeedback(result.message)
      }
    } catch {
      setSubmissionFeedback('Your server could not be submitted. Please try again.')
    } finally {
      setSubmissionPending(false)
    }
  }

  return (
    <div className="page-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <a className="brand-wrap" href="/" aria-label="MMORPG Top 100 home">
          <img className="site-logo" src={logoUrl} alt="MMORPG Top 100" />
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#rankings">Rankings</a>
          <a href="#submit">Submit</a>
          <a href="#pricing">Pricing</a>
          <a href="#games">Games</a>
        </nav>

        <a href="#submit" className="nav-button">Submission preview</a>
      </header>

      <main id="main-content" className="page-content">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="eyebrow">Community ranked</p>
            <p className="preview-note">Live approved server directory</p>
            <h1>Find the best MMORPG private servers.</h1>
            <p className="hero-text">
              Discover the most active worlds, compare player counts, and vote for the
              servers your community trusts most.
            </p>

            <div className="hero-actions">
              <a href="#rankings" className="primary-action">
                View rankings
              </a>
              <a href="#submit" className="secondary-action">
                Submit server
              </a>
            </div>

            <ul className="perks-list" aria-label="Marketplace benefits">
              {perks.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>
          </div>

          {samplePreview ? <aside className="hero-panel" aria-label="Featured server summary">
            <div className="panel-header">
              <span className="live-pill">{displayServer.status}</span>
              <span>Featured world</span>
            </div>

            <h2>{displayServer.name}</h2>
            <p className="panel-subtitle">
              {displayServer.mode} • {displayServer.players.toLocaleString()} online
            </p>

            <div className="mini-stats">
              <div>
                <strong>{displayServer.rating.toFixed(1)}</strong>
                <span>Avg. rating</span>
              </div>
              <div>
                <strong>{displayServer.votes.toLocaleString()}</strong>
                <span>Votes</span>
              </div>
              <div>
                <strong>{displayServer.trend}</strong>
                <span>Weekly growth</span>
              </div>
            </div>

            <a href="#server-detail" className="visit-button">
              View server details
            </a>
          </aside> : <aside className="hero-panel" aria-label="Live directory summary">
            <div className="panel-header"><span className="live-pill">Live</span><span>Verified listings</span></div>
            <h2>Approved private servers</h2>
            <p className="panel-subtitle">Browse each game's independent ranking without sample statistics.</p>
            <a href="#rankings" className="visit-button">Browse approved servers</a>
          </aside>}
          {siteConfig.advertisingWorkspaceEnabled && (
            <a className="secondary-action advertiser-workspace-link" href="/advertise">
              Open advertiser workspace
            </a>
          )}
        </section>

        <section className="stats-bar" aria-label="Directory status">
          <div><strong>82</strong><span>Supported games</span></div>
          <div><strong>Live</strong><span>Approved listings</span></div>
          <div><strong>Locked</strong><span>Voting until Phase 5</span></div>
        </section>

        <GameDirectory />

        {samplePreview ? <section id="rankings" className="rankings-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Top servers</p>
              <h2>Most voted MMORPG worlds</h2>
            </div>
            <div className="rank-controls">
              <div className="filter-row" aria-label="Server filters">
                {(['All', 'PvE', 'PvP', 'RPG'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={selectedMode === mode ? 'filter-button active' : 'filter-button'}
                    onClick={() => setSelectedMode(mode)}
                    aria-pressed={selectedMode === mode}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <label className="sort-wrap">
                <span>Sort by</span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as 'votes' | 'players' | 'rating')}
                  aria-label="Sort rankings"
                >
                  <option value="votes">Votes</option>
                  <option value="players">Players</option>
                  <option value="rating">Rating</option>
                </select>
              </label>
            </div>
          </div>

          <div className="leaderboard-wrapper">
            <div className="leaderboard" aria-label="Leaderboard list">
              {catalogStatus === 'loading' && <p role="status">Loading server rankings…</p>}
              {catalogStatus === 'error' && (
                <p role="alert">Server rankings are unavailable right now. Please try again later.</p>
              )}
              {catalogStatus === 'ready' && filteredServers.length === 0 && (
                <p role="status">No servers match this filter.</p>
              )}
              {filteredServers.map((server, index) => (
                <button
                  key={server.id}
                  type="button"
                  className={
                    effectiveSelectedServerId === server.id
                      ? 'leaderboard-item active'
                      : 'leaderboard-item'
                  }
                  onClick={() => setSelectedServerId(server.id)}
                  aria-pressed={effectiveSelectedServerId === server.id}
                >
                  <div className="rank-box">#{index + 1}</div>
                  <div className="server-meta">
                    <h3>{server.name}</h3>
                    <div className="meta-row">
                      <span>{server.region}</span>
                      <span>{server.mode}</span>
                    </div>
                  </div>
                  <div className="player-count">{server.players.toLocaleString()}</div>
                  <div className="vote-count">{server.votes.toLocaleString()} votes</div>
                </button>
              ))}
            </div>

            <aside
              id="server-detail"
              className="detail-panel"
              aria-label="Selected server details"
              aria-live="polite"
            >
              <p className="eyebrow">Server detail</p>
              <h3>{displayServer.name}</h3>
              <div className="detail-tags">
                <span>{displayServer.region}</span>
                <span>{displayServer.mode}</span>
                <span>{displayServer.status}</span>
              </div>
              <p>{displayServer.description}</p>

              <div className="detail-stats">
                <div>
                  <strong>{displayServer.players.toLocaleString()}</strong>
                  <span>Players</span>
                </div>
                <div>
                  <strong>{displayServer.votes.toLocaleString()}</strong>
                  <span>Votes</span>
                </div>
                <div>
                  <strong>{displayServer.rating.toFixed(1)}</strong>
                  <span>Rating</span>
                </div>
              </div>

              {selectedServer && siteConfig.votingEnabled && (
                <div className="vote-panel">
                  <button
                    type="button"
                    className="vote-button"
                    disabled={
                      pendingVoteId === selectedServer.id || votedServerIds.has(selectedServer.id)
                    }
                    onClick={() => void handleVote(selectedServer.id)}
                  >
                    {pendingVoteId === selectedServer.id
                      ? 'Recording vote…'
                      : votedServerIds.has(selectedServer.id)
                        ? 'Vote recorded'
                        : `Vote for ${selectedServer.name}`}
                  </button>
                  {voteFeedback[selectedServer.id] && (
                    <p className="vote-feedback" role="status">
                      {voteFeedback[selectedServer.id]}
                    </p>
                  )}
                  <p className="vote-disclaimer">Demo voting is limited to one vote per server.</p>
                </div>
              )}
              {selectedServer && !siteConfig.votingEnabled && (
                <p className="vote-disclaimer" role="status">
                  Voting will open after the secure voting service is ready.
                </p>
              )}
            </aside>
          </div>
        </section> : <ApprovedServersSection service={approvedServersService} />}

        <section className="feature-grid" aria-label="Platform features">
          <article className="feature-card">
            <p className="eyebrow">For players</p>
            <h3>Compare server quality</h3>
            <p>
              Check population, player reviews, and ranking trends before joining a new
              community.
            </p>
          </article>

          <article className="feature-card">
            <p className="eyebrow">For owners</p>
            <h3>Show your server</h3>
            <p>
              Reach players faster with a clean profile, stats, and public visibility.
            </p>
          </article>

          <article className="feature-card">
            <p className="eyebrow">For communities</p>
            <h3>Build trust</h3>
            <p>
              Verified listings and transparent rankings help players spot active, stable
              communities.
            </p>
          </article>
        </section>

        <section id="submit" className="submission-section">
          <div className="submission-copy">
            <p className="eyebrow">Submit your server</p>
            <h2>Submit your private server listing.</h2>
            <p>
              Share your server details for moderation review. Submitting a listing does
              not publish it immediately.
            </p>
          </div>

          {siteConfig.submissionsEnabled ? (
          <form className="submission-form" noValidate onSubmit={(event) => void handleSubmission(event)}>
            <label htmlFor="server-name">Server name</label>
            <input
              id="server-name"
              name="name"
              type="text"
              autoComplete="organization"
              aria-invalid={Boolean(submissionErrors.name)}
              aria-describedby={submissionErrors.name ? 'server-name-error' : undefined}
            />
            {submissionErrors.name && (
              <p id="server-name-error" className="field-error">{submissionErrors.name}</p>
            )}

            <label htmlFor="server-website">Website</label>
            <input
              id="server-website"
              name="website"
              type="url"
              inputMode="url"
              placeholder="https://example.com"
              autoComplete="url"
              aria-invalid={Boolean(submissionErrors.website)}
              aria-describedby={submissionErrors.website ? 'server-website-error' : 'website-help'}
            />
            <p id="website-help" className="field-help">Use a public HTTPS address.</p>
            {submissionErrors.website && (
              <p id="server-website-error" className="field-error">{submissionErrors.website}</p>
            )}

            <div className="form-row">
              <div>
                <label htmlFor="game-version">Game version</label>
                <input
                  id="game-version"
                  name="gameVersion"
                  type="text"
                  aria-invalid={Boolean(submissionErrors.gameVersion)}
                  aria-describedby={submissionErrors.gameVersion ? 'game-version-error' : undefined}
                />
                {submissionErrors.gameVersion && (
                  <p id="game-version-error" className="field-error">{submissionErrors.gameVersion}</p>
                )}
              </div>
              <div>
                <label htmlFor="server-region">Region</label>
                <input
                  id="server-region"
                  name="region"
                  type="text"
                  autoComplete="country-name"
                  aria-invalid={Boolean(submissionErrors.region)}
                  aria-describedby={submissionErrors.region ? 'server-region-error' : undefined}
                />
                {submissionErrors.region && (
                  <p id="server-region-error" className="field-error">{submissionErrors.region}</p>
                )}
              </div>
            </div>

            <label htmlFor="server-mode">Game mode</label>
            <select id="server-mode" name="mode" defaultValue="PvE">
              <option value="PvE">PvE</option>
              <option value="PvP">PvP</option>
              <option value="RPG">RPG</option>
            </select>

            <label htmlFor="server-description">Community description</label>
            <textarea
              id="server-description"
              name="description"
              rows={4}
              aria-invalid={Boolean(submissionErrors.description)}
              aria-describedby={submissionErrors.description ? 'server-description-error' : undefined}
            />
            {submissionErrors.description && (
              <p id="server-description-error" className="field-error">{submissionErrors.description}</p>
            )}

            <button type="submit" className="submit-button" disabled={submissionPending}>
              {submissionPending ? 'Submitting…' : 'Submit for review'}
            </button>
            {submissionFeedback && (
              <p className="submission-feedback" role="status">{submissionFeedback}</p>
            )}
          </form>
          ) : (
            <div className="submission-form" role="status">
              <h3>Submissions are coming soon</h3>
              <p>The form will open after secure review storage and abuse protection are ready.</p>
            </div>
          )}
        </section>

        <section id="pricing" className="pricing-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Pricing</p>
              <h2>Boost your server visibility</h2>
              <p className="section-note">
                Sponsorship packages are a public preview and are not available for purchase yet.
              </p>
            </div>
          </div>

          <div className="pricing-grid">
            {packages.map((pkg) => (
              <article
                key={pkg.name}
                className={pkg.highlighted ? 'price-card highlighted' : 'price-card'}
              >
                <p className="package-name">{pkg.name}</p>
                <h3>
                  {pkg.price}
                  <span>{pkg.period}</span>
                </h3>
                <p className="package-summary">{pkg.summary}</p>
                <ul>
                  {pkg.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <span className="package-status">Planned sponsorship</span>
              </article>
            ))}
          </div>

          <aside className="donation-panel" aria-labelledby="donation-heading">
            <div>
              <p className="eyebrow">Support the project</p>
              <h3 id="donation-heading">Donate with PayPal</h3>
              <p>
                Donations are checked manually. A donation does not automatically approve or
                activate an advertisement. Exclusive 7-day and 30-day placements require a
                separate submission and moderation review.
              </p>
            </div>
            <a
              className="primary-action donation-link"
              href={siteConfig.paypalDonationUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open PayPal donation page
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
          </aside>
        </section>
      </main>

      <footer className="site-footer">
        <p>MMORPG Top 100</p>
        <div>
          <a href="#rankings">Rankings</a>
          <a href="#submit">Submit</a>
          <a href="#pricing">Pricing</a>
        </div>
      </footer>
    </div>
  )
}

export default App
