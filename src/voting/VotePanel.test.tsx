import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VotePanel } from './VotePanel'

const readyAuth = { currentStatus: () => Promise.resolve('ready' as const), signIn: vi.fn(), register: vi.fn(), sendVerification: vi.fn(), refreshVerification: vi.fn(), signOut: vi.fn() }

describe('VotePanel', () => {
  beforeEach(() => {
    window.turnstile = {
      render: (_element, options) => {
        ;(options.callback as (token: string) => void)('challenge-token')
        return 'widget-id'
      },
      remove: vi.fn(),
      reset: vi.fn(),
    }
  })

  afterEach(() => { delete window.turnstile })

  it('submits an accessible vote and announces success', async () => {
    const user = userEvent.setup()
    const onVoteRecorded = vi.fn()
    const service = { vote: vi.fn().mockResolvedValue({ ok: true as const, votes: 21 }) }
    render(<VotePanel serverId="one" serverName="Flyff One" onVoteRecorded={onVoteRecorded} service={service} authService={readyAuth} turnstileSiteKey="test-key" />)

    const button = await screen.findByRole('button', { name: 'Vote for Flyff One' })
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    expect(service.vote).toHaveBeenCalledWith('one', 'challenge-token')
    expect(await screen.findByRole('status')).toHaveTextContent('Your vote was recorded. Flyff One now has 21 votes.')
    expect(onVoteRecorded).toHaveBeenCalledWith(21)
  })

  it('fails closed until the security check succeeds', async () => {
    window.turnstile!.render = vi.fn(() => 'widget-id')
    render(<VotePanel serverId="one" serverName="Flyff One" onVoteRecorded={vi.fn()} service={{ vote: vi.fn() }} authService={readyAuth} turnstileSiteKey="test-key" />)
    expect(await screen.findByRole('button', { name: 'Vote for Flyff One' })).toBeDisabled()
  })
})
