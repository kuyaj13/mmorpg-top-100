import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SubmissionPage } from './SubmissionPage'

describe('SubmissionPage', () => {
  const authService = {
    currentStatus: vi.fn().mockResolvedValue('ready' as const), signIn: vi.fn(), register: vi.fn(),
    sendVerification: vi.fn(), refreshVerification: vi.fn(), signOut: vi.fn(),
  }
  beforeEach(() => {
    window.turnstile = { render: vi.fn((_element, options) => { (options.callback as (token: string) => void)('challenge-token'); return 'submission-widget' }), remove: vi.fn(), reset: vi.fn() }
  })
  afterEach(() => { delete window.turnstile })

  it('uses canonical games and submits the labelled form', async () => {
    const user = userEvent.setup()
    const service = { submit: vi.fn().mockResolvedValue({ ok: true as const, reference: 'SUB-123' }) }
    render(<SubmissionPage service={service} authService={authService} turnstileSiteKey="test-key" />)
    const game = await screen.findByLabelText('Game')
    await waitFor(() => expect(window.turnstile!.render).toHaveBeenCalledWith(expect.any(HTMLElement), expect.objectContaining({ action: 'submit-server' })))
    expect(within(game).getByRole('option', { name: 'Flyff' })).toHaveValue('flyff')
    await user.type(screen.getByLabelText('Server name'), 'Flyff One')
    await user.type(screen.getByLabelText('Server website'), 'https://flyff.example/')
    await user.selectOptions(game, 'flyff')
    await user.type(screen.getByLabelText('Game version'), 'v22')
    await user.type(screen.getByLabelText('Primary region'), 'Asia')
    await user.selectOptions(screen.getByLabelText('Server mode'), 'PvE')
    await user.type(screen.getByLabelText('Description'), 'A community-focused Flyff server.')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(service.submit).toHaveBeenCalledWith(expect.objectContaining({ gameSlug: 'flyff', turnstileToken: 'challenge-token' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Reference: SUB-123')
  })

  it('focuses the first invalid field and exposes plain inline errors', async () => {
    const user = userEvent.setup()
    window.turnstile!.render = vi.fn(() => 'submission-widget')
    render(<SubmissionPage service={{ submit: vi.fn() }} authService={authService} turnstileSiteKey="test-key" />)
    await screen.findByLabelText('Game')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(screen.getByLabelText('Server name')).toHaveFocus()
    expect(screen.getByLabelText('Server name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Complete the security check.')).toHaveAttribute('role', 'alert')
  })

  it('does not expose the form or security challenge before verified authentication', async () => {
    const signedOut = { ...authService, currentStatus: vi.fn().mockResolvedValue('signed-out' as const) }
    render(<SubmissionPage service={{ submit: vi.fn() }} authService={signedOut} turnstileSiteKey="test-key" />)
    expect(await screen.findByText(/sign in or create a free player account/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit for review' })).not.toBeInTheDocument()
    expect(window.turnstile!.render).not.toHaveBeenCalled()
  })
})
