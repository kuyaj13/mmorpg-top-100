import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SubmissionPage } from './SubmissionPage'
import { applyPalette, GIFEncoder, quantize } from 'gifenc'

function animatedGif(frames: number) {
  const pixels = new Uint8Array(2 * 2 * 4)
  for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255
  const palette = quantize(pixels, 256)
  const indexed = applyPalette(pixels, palette)
  const encoder = GIFEncoder()
  for (let frame = 0; frame < frames; frame += 1) encoder.writeFrame(indexed, 2, 2, { palette, delay: 100 })
  encoder.finish()
  return new Uint8Array(encoder.bytes())
}

describe('SubmissionPage', () => {
  const authService = {
    currentStatus: vi.fn().mockResolvedValue('ready' as const), signIn: vi.fn(), register: vi.fn(),
    sendVerification: vi.fn(), refreshVerification: vi.fn(), signOut: vi.fn(),
  }
  beforeEach(() => {
    window.turnstile = { render: vi.fn((_element, options) => { (options.callback as (token: string) => void)('challenge-token'); return 'submission-widget' }), remove: vi.fn(), reset: vi.fn() }
    globalThis.createImageBitmap = vi.fn().mockResolvedValue({ width: 468, height: 60, close: vi.fn() })
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
    expect(screen.getByText(/highlighted fields/i)).toBeInTheDocument()
    expect(screen.getByText('Complete the security check.')).toHaveAttribute('role', 'alert')
  })

  it('shows a visible server failure and connects duplicate errors to relevant fields', async () => {
    const user = userEvent.setup()
    const service = { submit: vi.fn().mockResolvedValue({ ok: false as const, message: 'This server is already listed or pending review.', fieldErrors: { name: 'This server is already listed or pending review.', website: 'This server is already listed or pending review.' } }) }
    render(<SubmissionPage service={service} authService={authService} turnstileSiteKey="test-key" />)
    await user.type(await screen.findByLabelText('Server name'), 'Flyff One')
    await user.type(screen.getByLabelText('Server website'), 'https://flyff.example/')
    await user.selectOptions(screen.getByLabelText('Game'), 'flyff')
    await user.type(screen.getByLabelText('Game version'), 'v22')
    await user.type(screen.getByLabelText('Primary region'), 'Asia')
    await user.selectOptions(screen.getByLabelText('Server mode'), 'PvE')
    await user.type(screen.getByLabelText('Description'), 'A community-focused Flyff server.')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    const visibleFailure = (await screen.findAllByText('This server is already listed or pending review.')).find((element) => element.classList.contains('submission-result'))
    expect(visibleFailure).toHaveAttribute('role', 'alert')
    expect(screen.getByLabelText('Server name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Server website')).toHaveAccessibleDescription(/already listed or pending review/i)
  })

  it('shows an API banner rejection beside the banner field', async () => {
    const message = 'Choose a valid 468 by 60 pixel GIF, PNG, or JPEG banner.'
    const service = { submit: vi.fn().mockResolvedValue({ ok: false as const, message, fieldErrors: { banner: message } }) }
    const user = userEvent.setup()
    render(<SubmissionPage service={service} authService={authService} turnstileSiteKey="test-key" />)
    await user.type(await screen.findByLabelText('Server name'), 'Flyff One')
    await waitFor(() => expect(window.turnstile!.render).toHaveBeenCalled())
    await user.type(screen.getByLabelText('Server website'), 'https://flyff.example/')
    await user.selectOptions(screen.getByLabelText('Game'), 'flyff')
    await user.type(screen.getByLabelText('Game version'), 'v22')
    await user.type(screen.getByLabelText('Primary region'), 'Asia')
    await user.selectOptions(screen.getByLabelText('Server mode'), 'PvE')
    await user.type(screen.getByLabelText('Description'), 'A community-focused Flyff server.')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    expect(await screen.findByText(message, { selector: '.field-error' })).toBeInTheDocument()
    expect(screen.getByLabelText('Banner image')).toHaveAttribute('aria-invalid', 'true')
  })

  it('offers a clearly labelled optional free banner in the same form', async () => {
    render(<SubmissionPage service={{ submit: vi.fn() }} authService={authService} turnstileSiteKey="test-key" />)
    expect(await screen.findByRole('group', { name: 'Banner (optional and free)' })).toBeInTheDocument()
    expect(screen.getByLabelText('Banner image')).toHaveAttribute('accept', 'image/gif,image/png,image/jpeg')
    expect(screen.getByLabelText('Banner image')).toHaveAccessibleDescription(/468 by 60 pixel/i)
  })

  it('shows the exact dimension error beside a square banner without submitting it', async () => {
    const user = userEvent.setup()
    const service = { submit: vi.fn() }
    vi.mocked(globalThis.createImageBitmap).mockResolvedValue({ width: 1024, height: 1024, close: vi.fn() } as unknown as ImageBitmap)
    render(<SubmissionPage service={service} authService={authService} turnstileSiteKey="test-key" />)
    await user.type(await screen.findByLabelText('Server name'), 'Liberty Troupe')
    await waitFor(() => expect(window.turnstile!.render).toHaveBeenCalled())
    await user.type(screen.getByLabelText('Server website'), 'https://liberty.example/')
    await user.selectOptions(screen.getByLabelText('Game'), 'flyff')
    await user.type(screen.getByLabelText('Game version'), 'v22')
    await user.type(screen.getByLabelText('Primary region'), 'Asia')
    await user.selectOptions(screen.getByLabelText('Server mode'), 'PvE')
    await user.type(screen.getByLabelText('Description'), 'A community-focused private Flyff server.')
    await user.upload(screen.getByLabelText('Banner image'), new File(['image'], 'libertytroupe.png', { type: 'image/png' }))
    await user.type(screen.getByLabelText('Banner description'), 'Liberty Troupe blue and red emblem')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))
    await waitFor(() => expect([...document.querySelectorAll('.field-error')].map((item) => item.textContent)).toEqual(['Choose a banner that is exactly 468 by 60 pixels.']))
    expect(screen.getByLabelText('Banner image')).toHaveFocus()
    expect(service.submit).not.toHaveBeenCalled()
  })

  it('shows the 45-frame GIF error beside the submission banner', async () => {
    const user = userEvent.setup()
    const service = { submit: vi.fn() }
    render(<SubmissionPage service={service} authService={authService} turnstileSiteKey="test-key" />)
    await user.type(await screen.findByLabelText('Server name'), 'Animated Flyff')
    await user.type(screen.getByLabelText('Server website'), 'https://animated.example/')
    await user.selectOptions(screen.getByLabelText('Game'), 'flyff')
    await user.type(screen.getByLabelText('Game version'), 'v22')
    await user.type(screen.getByLabelText('Primary region'), 'Asia')
    await user.selectOptions(screen.getByLabelText('Server mode'), 'PvE')
    await user.type(screen.getByLabelText('Description'), 'A community-focused animated Flyff server.')
    await user.upload(screen.getByLabelText('Banner image'), new File([animatedGif(46)], 'animated.gif', { type: 'image/gif' }))
    await user.type(screen.getByLabelText('Banner description'), 'Animated Flyff fantasy banner')
    await user.click(screen.getByRole('button', { name: 'Submit for review' }))

    expect(await screen.findByText('Animated GIFs may contain no more than 45 frames.')).toHaveAttribute('role', 'alert')
    expect(screen.getByLabelText('Banner image')).toHaveAccessibleDescription(/no more than 45 frames/i)
    expect(screen.getByLabelText('Banner image')).toHaveFocus()
    expect(service.submit).not.toHaveBeenCalled()
  })

  it('resets an expired security check and tells the user to complete it again', async () => {
    render(<SubmissionPage service={{ submit: vi.fn() }} authService={authService} turnstileSiteKey="test-key" />)
    await screen.findByLabelText('Game')
    await waitFor(() => expect(window.turnstile!.render).toHaveBeenCalled())
    const options = vi.mocked(window.turnstile!.render).mock.calls[0][1]
    act(() => (options['expired-callback'] as () => void)())
    expect(window.turnstile!.reset).toHaveBeenCalledWith('submission-widget')
    expect(screen.getByRole('alert')).toHaveTextContent('The security check expired. Complete it again.')
  })

  it('does not expose the form or security challenge before verified authentication', async () => {
    const signedOut = { ...authService, currentStatus: vi.fn().mockResolvedValue('signed-out' as const) }
    render(<SubmissionPage service={{ submit: vi.fn() }} authService={signedOut} turnstileSiteKey="test-key" />)
    expect(await screen.findByText(/sign in or create a free player account/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit for review' })).not.toBeInTheDocument()
    expect(window.turnstile!.render).not.toHaveBeenCalled()
  })
})
