import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CatalogService, Server } from '../catalog/types'
import GamePage from './GamePage'

const flyffServer: Server = {
  id: 'flyff-one',
  gameSlug: 'flyff',
  name: 'Flyff One',
  players: 100,
  votes: 20,
  region: 'Asia',
  mode: 'PvE',
  rating: 4.5,
  description: 'A Flyff community.',
  status: 'Live',
  trend: '+1%',
}

const otherGameServer: Server = {
  ...flyffServer,
  id: 'other-one',
  gameSlug: 'ragnarok-online',
  name: 'Ragnarok One',
}

describe('GamePage', () => {
  it('keeps rankings scoped to the selected game even if a service returns extra records', async () => {
    const catalogService: CatalogService = {
      listServers: () => Promise.resolve([flyffServer, otherGameServer]),
    }

    render(<GamePage slug="flyff" catalogService={catalogService} />)

    const rankings = await screen.findByRole('list', { name: 'Flyff server rankings' })
    expect(within(rankings).getByText('Flyff One')).toBeInTheDocument()
    expect(within(rankings).queryByText('Ragnarok One')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Exclusive Flyff servers' })).toBeInTheDocument()
    expect(screen.getByText(/no active sponsored servers for this game/i)).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('â€¦')
  })

  it('announces sorting changes without making the ranking list live', async () => {
    const user = userEvent.setup()
    const catalogService: CatalogService = { listServers: () => Promise.resolve([flyffServer]) }
    render(<GamePage slug="flyff" catalogService={catalogService} />)

    const rankings = await screen.findByRole('list', { name: 'Flyff server rankings' })
    await user.selectOptions(screen.getByLabelText('Sort by'), 'players')
    expect(screen.getByText('Rankings sorted by players.')).toHaveAttribute('role', 'status')
    expect(rankings).not.toHaveAttribute('aria-live')
  })

  it('does not fall back to another game for an unsupported slug', () => {
    render(<GamePage slug="unsupported-game" />)

    expect(screen.getByRole('heading', { name: 'Game not found' })).toBeInTheDocument()
    expect(screen.queryByText(/private server rankings/i)).not.toBeInTheDocument()
  })

  it('keeps voting fail-closed on game rankings', async () => {
    const catalogService: CatalogService = { listServers: () => Promise.resolve([flyffServer]) }
    render(<GamePage slug="flyff" catalogService={catalogService} />)

    expect(await screen.findByText(/voting will open after the secure voting service/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vote for Flyff One' })).not.toBeInTheDocument()
  })
})
