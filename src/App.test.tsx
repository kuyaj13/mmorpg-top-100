import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { CatalogService, VotingService } from './catalog/types'
import type { SubmissionService } from './submission/types'

describe('App', () => {
  it('renders the home page heading and primary CTA', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: /find the best mmorpg private servers/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view rankings/i })).toBeInTheDocument()
    expect(screen.getByText(/public preview · sample listing data/i)).toBeInTheDocument()
  })

  it('presents the reviewed submission flow and future sponsorships honestly', () => {
    render(<App />)

    expect(screen.getByRole('button', { name: /submit for review/i })).toBeInTheDocument()
    expect(screen.getAllByText(/planned sponsorship/i)).toHaveLength(2)
    expect(screen.getByRole('heading', { name: /\$10.*7 days/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /\$20.*30 days/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /get started|join now/i })).not.toBeInTheDocument()
    const donationLink = screen.getByRole('link', { name: /open paypal donation page/i })
    expect(donationLink).toHaveAttribute('href', 'https://www.paypal.com/paypalme/VivaMU')
    expect(donationLink).toHaveAttribute('target', '_blank')
    expect(screen.getByText(/does not automatically approve or activate/i)).toBeInTheDocument()
  })

  it('filters servers by mode and updates the selected detail panel', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'PvP' }))

    const leaderboard = screen.getByLabelText(/leaderboard list/i)
    const leaderboardButton = await within(leaderboard).findByRole('button', {
      name: /dragonfall origins/i,
    })
    const detailPanel = screen.getByRole('complementary', {
      name: /selected server details/i,
    })

    expect(leaderboardButton).toBeInTheDocument()
    expect(detailPanel).toHaveTextContent('Dragonfall Origins')
    expect(detailPanel).toHaveTextContent('Large-scale PvP arenas')
    expect(leaderboardButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('sorts the leaderboard by player count when selected', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.selectOptions(screen.getByLabelText(/sort by/i), 'players')

    const leaderboardItems = (await screen.findAllByRole('button')).filter((button) =>
      button.className.includes('leaderboard-item'),
    )

    expect(leaderboardItems[0]).toHaveTextContent('Eclipse Reborn')
  })

  it('shows a plain-language message when the catalog cannot load', async () => {
    const unavailableCatalog: CatalogService = {
      listServers: () => Promise.reject(new Error('internal catalog failure')),
    }

    render(<App catalogService={unavailableCatalog} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Server rankings are unavailable right now. Please try again later.',
    )
    expect(screen.queryByText(/internal catalog failure/i)).not.toBeInTheDocument()
  })

  it('shows an empty state when the catalog has no listings', async () => {
    const emptyCatalog: CatalogService = {
      listServers: () => Promise.resolve([]),
    }

    render(<App catalogService={emptyCatalog} />)

    expect(await screen.findByText(/no servers match this filter/i)).toBeInTheDocument()
  })

  it('records a vote using the authoritative total returned by the voting service', async () => {
    const user = userEvent.setup()
    const votingService: VotingService = {
      voteForServer: () => Promise.resolve({ ok: true, votes: 9000 }),
    }

    render(<App votingService={votingService} />)

    await user.click(await screen.findByRole('button', { name: /vote for eclipse reborn/i }))

    expect(await screen.findByText(/your vote has been recorded/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /vote recorded/i })).toBeDisabled()
    expect(
      screen.getByRole('complementary', { name: /selected server details/i }),
    ).toHaveTextContent('9,000')
  })

  it('keeps technical voting failures out of the interface', async () => {
    const user = userEvent.setup()
    const unavailableVotingService: VotingService = {
      voteForServer: () => Promise.reject(new Error('voteForServer database timeout')),
    }

    render(<App votingService={unavailableVotingService} />)

    await user.click(await screen.findByRole('button', { name: /vote for eclipse reborn/i }))

    expect(await screen.findByText(/your vote could not be recorded/i)).toBeInTheDocument()
    expect(screen.queryByText(/database timeout/i)).not.toBeInTheDocument()
  })

  it('shows plain inline errors for an incomplete server submission', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /submit for review/i }))

    expect(screen.getAllByText('This field is required.')).toHaveLength(4)
    expect(screen.getByText('Please enter a valid server URL.')).toBeInTheDocument()
    expect(screen.getByLabelText(/server name/i)).toHaveAttribute('aria-invalid', 'true')
  })

  it('submits valid server details for review and clears the form', async () => {
    const user = userEvent.setup()
    const submissionService: SubmissionService = {
      submitServer: () => Promise.resolve({ ok: true, reference: 'preview-test' }),
    }

    render(<App submissionService={submissionService} />)

    await user.type(screen.getByLabelText(/server name/i), 'Moonlight Realms')
    await user.type(screen.getByLabelText(/^website$/i), 'https://moonlight.example')
    await user.type(screen.getByLabelText(/game version/i), '1.0')
    await user.type(screen.getByLabelText(/^region$/i), 'Asia')
    await user.type(screen.getByLabelText(/community description/i), 'A friendly raid community.')
    await user.click(screen.getByRole('button', { name: /submit for review/i }))

    expect(await screen.findByText(/submitted for review/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/server name/i)).toHaveValue('')
  })
})
