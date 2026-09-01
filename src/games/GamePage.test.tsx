import { render, screen, within } from '@testing-library/react'
import type { RankingsService } from './rankingsService'
import GamePage from './GamePage'

const flyffServer = { id: 'prologic-flyff', name: 'Prologic Flyff', votes: 20 }

function service(servers = [flyffServer]): RankingsService {
  return { getGameRankings: (gameSlug) => Promise.resolve({ game: { slug: gameSlug, name: 'Flyff' }, servers }) }
}

describe('GamePage', () => {
  it('fails closed if a service returns a different game', async () => {
    const rankingsService: RankingsService = {
      getGameRankings: () => Promise.resolve({
        game: { slug: 'ragnarok-online', name: 'Ragnarok Online' },
        servers: [flyffServer],
      }),
    }
    render(<GamePage slug="flyff" rankingsService={rankingsService} />)
    expect(await screen.findByText(/no approved flyff servers yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Flyff server rankings' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Exclusive Flyff servers' })).toBeInTheDocument()
  })

  it('renders only the minimal verified ranking contract', async () => {
    render(<GamePage slug="flyff" rankingsService={service()} />)
    const rankings = await screen.findByRole('list', { name: 'Flyff server rankings' })
    expect(within(rankings).getByText('Prologic Flyff')).toBeInTheDocument()
    expect(within(rankings).getByText('20 votes')).toBeInTheDocument()
    expect(screen.queryByLabelText('Sort by')).not.toBeInTheDocument()
    const banner = document.querySelector<HTMLImageElement>('img[src="/banners/prologic-flyff-preview.gif"]')
    expect(banner).not.toBeNull()
    expect(banner).toHaveAttribute('src', '/banners/prologic-flyff-preview.gif')
    const rankingButton = screen.getByRole('button', { name: 'Prologic Flyff20 votes' })
    expect(rankingButton).toContainElement(banner)
    expect(banner!.compareDocumentPosition(within(rankingButton).getByText('Prologic Flyff')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('does not fall back to another game for an unsupported slug', () => {
    render(<GamePage slug="unsupported-game" />)
    expect(screen.getByRole('heading', { name: 'Game not found' })).toBeInTheDocument()
    expect(screen.queryByText(/private server rankings/i)).not.toBeInTheDocument()
  })

  it('keeps voting fail-closed on game rankings', async () => {
    render(<GamePage slug="flyff" rankingsService={service()} />)
    expect(await screen.findByText(/voting will open after the secure voting service/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /vote for/i })).not.toBeInTheDocument()
  })
})
