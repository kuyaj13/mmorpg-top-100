import { render, screen, within } from '@testing-library/react'
import type { RankingsService } from './rankingsService'
import GamePage from './GamePage'

const flyffServer = {
  id: 'prologic-flyff', name: 'Prologic Flyff', website: 'https://www.prologicflyff.com/', votes: 20,
  gameVersion: 'v22', region: 'Global', mode: 'PvP' as const, description: 'A community-focused Flyff server.',
  banner: { url: 'https://api.mmorpgtop100.com/api/advertising/banners/62719124-cb58-41e6-8086-3bc241394f5d', staticUrl: 'https://api.mmorpgtop100.com/api/advertising/banners/62719124-cb58-41e6-8086-3bc241394f5d?static=1', altText: 'Prologic Flyff server banner' },
}

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
    const banner = document.querySelector<HTMLImageElement>('img[src*="62719124-cb58-41e6-8086-3bc241394f5d"]')
    expect(banner).not.toBeNull()
    expect(banner).toHaveAttribute('alt', 'Prologic Flyff server banner')
    const rankingButton = screen.getByRole('button', { name: /prologic flyff server banner.*prologic flyff.*20 votes/i })
    expect(rankingButton).toContainElement(banner)
    expect(banner!.compareDocumentPosition(within(rankingButton).getByText('Prologic Flyff')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('A community-focused Flyff server.')).toBeInTheDocument()
    const websiteLink = screen.getByRole('link', { name: /visit website\s*for prologic flyff.*opens in a new tab/i })
    expect(websiteLink).toHaveAttribute('href', 'https://www.prologicflyff.com/')
    expect(websiteLink).toHaveAttribute('rel', 'noopener noreferrer')
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
