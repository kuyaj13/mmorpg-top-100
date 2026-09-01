import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { catalogService } from './catalog/catalogService'
import type { CatalogService } from './catalog/types'
import type { ApprovedServersService } from './home/approvedServersService'

const approvedServersService: ApprovedServersService = {
  list: () => Promise.resolve([{ id: 'prologic', name: 'Prologic Flyff', website: 'https://www.prologicflyff.com/', votes: 0, game: { slug: 'flyff', name: 'Flyff' } }]),
}

describe('App', () => {
  it('renders the home page heading and live approved listing', async () => {
    render(<App approvedServersService={approvedServersService} />)
    expect(screen.getByRole('heading', { name: /find the best mmorpg private servers/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view rankings/i })).toBeInTheDocument()
    expect(screen.getByText(/live approved server directory/i)).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Prologic Flyff' })).toBeInTheDocument()
  })

  it('presents the reviewed submission flow and future sponsorships honestly', () => {
    render(<App approvedServersService={approvedServersService} />)
    expect(screen.getByRole('heading', { name: /submissions are coming soon/i })).toBeInTheDocument()
    expect(screen.getAllByText(/planned sponsorship/i)).toHaveLength(2)
    expect(screen.getByRole('heading', { name: /\$10.*7 days/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /\$20.*30 days/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /get started|join now/i })).not.toBeInTheDocument()
    const donationLink = screen.getByRole('link', { name: /open paypal donation page/i })
    expect(donationLink).toHaveAttribute('href', 'https://www.paypal.com/paypalme/VivaMU')
    expect(donationLink).toHaveAttribute('target', '_blank')
  })

  it('keeps the legacy sample fixture isolated to injected tests', async () => {
    const user = userEvent.setup()
    render(<App catalogService={catalogService} />)
    await user.click(screen.getByRole('button', { name: 'PvP' }))
    const leaderboard = screen.getByLabelText(/leaderboard list/i)
    const leaderboardButton = await within(leaderboard).findByRole('button', { name: /dragonfall origins/i })
    expect(screen.getByRole('complementary', { name: /selected server details/i })).toHaveTextContent('Dragonfall Origins')
    expect(leaderboardButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a plain-language message when an injected catalog cannot load', async () => {
    const unavailableCatalog: CatalogService = { listServers: () => Promise.reject(new Error('internal catalog failure')) }
    render(<App catalogService={unavailableCatalog} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Server rankings are unavailable right now. Please try again later.')
    expect(screen.queryByText(/internal catalog failure/i)).not.toBeInTheDocument()
  })

  it('shows an honest empty live directory state', async () => {
    const emptyService: ApprovedServersService = { list: () => Promise.resolve([]) }
    render(<App approvedServersService={emptyService} />)
    expect(await screen.findByText(/there are no approved servers yet/i)).toBeInTheDocument()
  })

  it('keeps voting and submissions fail-closed', () => {
    render(<App approvedServersService={approvedServersService} />)
    expect(screen.getByText(/voting until phase 5/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /vote for/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit for review/i })).not.toBeInTheDocument()
  })
})
