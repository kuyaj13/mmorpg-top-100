import { act, fireEvent, render, screen } from '@testing-library/react'
import { ExclusiveServers } from './ExclusiveServers'

const ads = [
  { id: 'a', serverId: 'one', gameSlug: 'flyff', serverName: 'Flyff One', website: 'https://one.example/', bannerUrl: 'https://cdn.example/one.gif', staticBannerUrl: 'https://cdn.example/one.png', altText: 'Flyff One fantasy banner', expiresAt: '2026-10-01T00:00:00Z' },
  { id: 'b', serverId: 'two', gameSlug: 'flyff', serverName: 'Flyff Two', website: 'https://two.example/', bannerUrl: 'https://cdn.example/two.gif', staticBannerUrl: 'https://cdn.example/two.png', altText: 'Flyff Two fantasy banner', expiresAt: '2026-10-01T00:00:00Z' },
]

describe('ExclusiveServers', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(0)
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  })
  afterEach(() => vi.useRealTimers())

  it('renders a public sponsored link and supports manual rotation', async () => {
    render(<ExclusiveServers gameSlug="flyff" gameName="Flyff" service={{ list: vi.fn().mockResolvedValue(ads) }} />)
    await act(async () => {})
    const first = screen.getByRole('link', { name: /Flyff One, Sponsored.*new tab/i })
    expect(first).toHaveAttribute('href', 'https://one.example/')
    expect(first).toHaveAttribute('target', '_blank')
    expect(first).toHaveAttribute('rel', 'noopener noreferrer sponsored external')
    fireEvent.click(screen.getByRole('button', { name: 'Show next sponsored server' }))
    expect(screen.getByRole('link', { name: /Flyff Two, Sponsored.*new tab/i })).toBeInTheDocument()
  })

  it('does not show a redundant counter when only one sponsored server is active', async () => {
    render(<ExclusiveServers gameSlug="flyff" gameName="Flyff" service={{ list: vi.fn().mockResolvedValue([ads[0]]) }} />)
    await act(async () => {})
    expect(screen.getByRole('link', { name: /Flyff One, Sponsored.*new tab/i })).toBeInTheDocument()
    expect(screen.queryByText(/Sponsored server 1 of 1/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sponsored server/i })).not.toBeInTheDocument()
  })

  it('rotates every 15 seconds and pauses while hovered', async () => {
    render(<ExclusiveServers gameSlug="flyff" gameName="Flyff" service={{ list: vi.fn().mockResolvedValue(ads) }} />)
    await act(async () => {})
    screen.getByText(/Flyff One$/)
    act(() => vi.advanceTimersByTime(15_000))
    expect(screen.getByText(/Flyff Two$/)).toBeInTheDocument()
    const section = screen.getByRole('heading', { name: 'Exclusive Flyff servers' }).closest('section')!
    fireEvent.pointerEnter(section)
    act(() => vi.advanceTimersByTime(15_000))
    expect(screen.getByText(/Flyff Two$/)).toBeInTheDocument()
  })

  it('keeps rotation paused until the visitor resumes it and announces only manual changes', async () => {
    render(<ExclusiveServers gameSlug="flyff" gameName="Flyff" service={{ list: vi.fn().mockResolvedValue(ads) }} />)
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: 'Pause rotation' }))
    act(() => vi.advanceTimersByTime(30_000))
    expect(screen.getByText(/Flyff One$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resume rotation' })).toHaveAttribute('aria-pressed','true')
    expect(screen.getByRole('status', { hidden: true })).toBeEmptyDOMElement()
    fireEvent.click(screen.getByRole('button', { name: 'Show next sponsored server' }))
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('Sponsored server 2 of 2: Flyff Two')
  })

  it('uses the static image and stops automatic rotation for reduced motion', async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    render(<ExclusiveServers gameSlug="flyff" gameName="Flyff" service={{ list: vi.fn().mockResolvedValue(ads) }} />)
    await act(async () => {})
    expect(screen.getByRole('img')).toHaveAttribute('src', ads[0].staticBannerUrl)
    expect(screen.queryByRole('button', { name: 'Pause rotation' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show next sponsored server' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(30_000))
    expect(screen.getByText(/Flyff One$/)).toBeInTheDocument()
  })

  it('removes a sponsored server when its placement expires while the page remains open', async () => {
    const expiring = [{ ...ads[0], expiresAt: new Date(1_000).toISOString() }]
    render(<ExclusiveServers gameSlug="flyff" gameName="Flyff" service={{ list: vi.fn().mockResolvedValue(expiring) }} />)
    await act(async () => {})
    expect(screen.getByRole('link', { name: /Flyff One, Sponsored.*new tab/i })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(1_000))
    expect(screen.queryByRole('link', { name: /Flyff One, Sponsored.*new tab/i })).not.toBeInTheDocument()
    expect(screen.getByText('There are no active sponsored servers for this game.')).toBeInTheDocument()
  })
})
