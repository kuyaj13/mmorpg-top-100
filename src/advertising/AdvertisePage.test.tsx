import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdvertisePage from './AdvertisePage'
import type { AdvertiserAuthService, AdvertisingService } from './types'

const readyAuth: AdvertiserAuthService = {
  currentStatus: () => Promise.resolve('ready'),
  signIn: () => Promise.resolve('ready'),
  register: () => Promise.resolve('verify-email'),
  sendVerification: () => Promise.resolve(),
  refreshVerification: () => Promise.resolve(true),
  signOut: () => Promise.resolve(),
}

describe('AdvertisePage', () => {
  it('requires an owner account before loading private advertising data', async () => {
    let loaded = false
    const authService: AdvertiserAuthService = { ...readyAuth, currentStatus: () => Promise.resolve('signed-out') }
    const advertisingService: AdvertisingService = {
      loadWorkspace: () => { loaded = true; return Promise.reject(new Error('should not load')) },
      createClaim: () => Promise.resolve({ ok: false, message: 'Not available.' }),
    }
    render(<AdvertisePage authService={authService} advertisingService={advertisingService} />)

    expect(await screen.findByRole('heading', { name: 'Server owner account' })).toBeInTheDocument()
    expect(loaded).toBe(false)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter a password with at least 8 characters.')
    expect(screen.getByLabelText('Email address')).toHaveFocus()
  })

  it('submits only the selected approved server, duration, and PayPal reference', async () => {
    const user = userEvent.setup()
    let submitted: { serverId: string; packageCode: string; donorReference: string; turnstileToken: string } | undefined
    const advertisingService: AdvertisingService = {
      loadWorkspace: () => Promise.resolve({
        servers: [{ id: 'server-1', name: 'Flyff One', gameName: 'Flyff', gameSlug: 'flyff' }],
        packages: [{ code: 'exclusive_7_day', durationDays: 7, tier: 'exclusive', priceMinor: '1000', currency: 'USD' }],
        claims: [],
      }),
      createClaim: (input) => { submitted = input; return Promise.resolve({ ok: true, message: 'Your donation claim was submitted for manual review.' }) },
    }
    render(<AdvertisePage authService={readyAuth} advertisingService={advertisingService} />)

    await user.selectOptions(await screen.findByLabelText('Approved server'), 'server-1')
    await user.selectOptions(screen.getByLabelText('Placement duration'), 'exclusive_7_day')
    await user.type(screen.getByLabelText('PayPal transaction reference'), 'PAYPAL123456')
    const turnstileResponse = document.createElement('input')
    turnstileResponse.type = 'hidden'
    turnstileResponse.name = 'cf-turnstile-response'
    turnstileResponse.value = 'verified-challenge-token'
    screen.getByRole('button', { name: 'Submit for manual review' }).closest('form')?.append(turnstileResponse)
    await user.click(screen.getByRole('button', { name: 'Submit for manual review' }))

    expect(submitted).toEqual({ serverId: 'server-1', packageCode: 'exclusive_7_day', donorReference: 'PAYPAL123456', turnstileToken: 'verified-challenge-token' })
    expect(await screen.findByText('Your donation claim was submitted for manual review.')).toBeInTheDocument()
    expect(screen.getByText('Your donation claim was submitted for manual review.')).toHaveFocus()
  })

  it('does not submit a claim until the security check is complete', async () => {
    const user = userEvent.setup()
    let submitted = false
    const advertisingService: AdvertisingService = {
      loadWorkspace: () => Promise.resolve({
        servers: [{ id: 'server-1', name: 'Flyff One', gameName: 'Flyff', gameSlug: 'flyff' }],
        packages: [{ code: 'exclusive_7_day', durationDays: 7, tier: 'exclusive', priceMinor: '1000', currency: 'USD' }],
        claims: [],
      }),
      createClaim: () => { submitted = true; return Promise.resolve({ ok: true, message: 'Submitted.' }) },
    }
    render(<AdvertisePage authService={readyAuth} advertisingService={advertisingService} />)
    await user.selectOptions(await screen.findByLabelText('Approved server'), 'server-1')
    await user.selectOptions(screen.getByLabelText('Placement duration'), 'exclusive_7_day')
    await user.type(screen.getByLabelText('PayPal transaction reference'), 'PAYPAL123456')
    await user.click(screen.getByRole('button', { name: 'Submit for manual review' }))
    expect(submitted).toBe(false)
    expect(screen.getByRole('alert')).toHaveTextContent('Complete the security check.')
    expect(screen.getByRole('group', { name: 'Security check' })).toHaveFocus()
  })

  it('keeps banner upload locked until trusted scanning is available', async () => {
    const advertisingService: AdvertisingService = {
      loadWorkspace: () => Promise.resolve({ servers: [], packages: [], claims: [] }),
      createClaim: () => Promise.resolve({ ok: false, message: 'Not available.' }),
    }
    render(<AdvertisePage authService={readyAuth} advertisingService={advertisingService} />)

    expect(await screen.findByText(/uploading is currently locked for safety/i)).toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/â|Â/)
  })
})
