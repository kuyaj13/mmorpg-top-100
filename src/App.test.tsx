import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { CatalogService } from './catalog/types'

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

    expect(screen.getByRole('heading', { name: /submissions are coming soon/i })).toBeInTheDocument()
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

  it('keeps voting and submissions fail-closed in the public preview', async () => {
    render(<App />)

    expect(await screen.findByText(/voting will open after the secure voting service/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /vote for/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument()
  })
})
