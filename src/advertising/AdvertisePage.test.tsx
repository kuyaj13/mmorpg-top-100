import { render, screen,waitFor } from '@testing-library/react'
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
  beforeEach(()=>{let widget=0;window.turnstile={render:vi.fn((_element,options)=>{(options.callback as (token:string)=>void)('verified-challenge-token');widget+=1;return `widget-${widget}`}),remove:vi.fn(),reset:vi.fn()}})
  afterEach(()=>{delete window.turnstile})
  it('requires an owner account before loading private advertising data', async () => {
    let loaded = false
    const authService: AdvertiserAuthService = { ...readyAuth, currentStatus: () => Promise.resolve('signed-out') }
    const advertisingService: AdvertisingService = {
      loadWorkspace: () => { loaded = true; return Promise.reject(new Error('should not load')) },
      createClaim: () => Promise.resolve({ ok: false, message: 'Not available.' }),
    }
    render(<AdvertisePage authService={authService} advertisingService={advertisingService} turnstileSiteKey="test-key" />)

    expect(await screen.findByRole('heading', { name: 'Server owner account' })).toBeInTheDocument()
    expect(loaded).toBe(false)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByLabelText('Email address')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Enter a password with at least 8 characters.')
    expect(screen.getByLabelText('Email address')).toHaveFocus()
  })

  it('tells an unverified advertiser to check the spam folder', async () => {
    const authService: AdvertiserAuthService = { ...readyAuth, currentStatus: () => Promise.resolve('verify-email') }
    const advertisingService: AdvertisingService = {
      loadWorkspace: vi.fn(),
      createClaim: () => Promise.resolve({ ok: false, message: 'Not available.' }),
    }
    render(<AdvertisePage authService={authService} advertisingService={advertisingService} turnstileSiteKey="test-key" />)
    expect(await screen.findByText(/check your spam folder if the message is not in your inbox/i)).toBeInTheDocument()
    expect(advertisingService.loadWorkspace).not.toHaveBeenCalled()
  })

  it('submits only the selected approved server, duration, and PayPal reference', async () => {
    const user = userEvent.setup()
    let submitted: { serverId: string; packageCode: string; donorReference: string; turnstileToken: string } | undefined
    const advertisingService: AdvertisingService = {
      loadWorkspace: () => Promise.resolve({
        servers: [{ id: 'server-1', name: 'Flyff One', gameName: 'Flyff', gameSlug: 'flyff' }],
        packages: [
          { code: 'exclusive_7_day', durationDays: 7, tier: 'exclusive', priceMinor: '1000', currency: 'USD' },
          { code: 'exclusive_30_day', durationDays: 30, tier: 'exclusive', priceMinor: '2000', currency: 'USD' },
        ],
        claims: [],
      }),
      createClaim: (input) => { submitted = input; return Promise.resolve({ ok: true, message: 'Your donation claim was submitted for manual review.',claimId:'123e4567-e89b-42d3-a456-426614174000' }) },
    }
    render(<AdvertisePage authService={readyAuth} advertisingService={advertisingService} turnstileSiteKey="test-key" />)

    await user.selectOptions(await screen.findByLabelText('Approved server', { selector: '#claim-server' }), 'server-1')
    await waitFor(()=>expect(window.turnstile?.render).toHaveBeenCalled())
    expect(screen.getByRole('option', { name: '7 days - $10.00 USD' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '30 days - $20.00 USD' })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Placement duration'), 'exclusive_30_day')
    await user.type(screen.getByLabelText('PayPal transaction reference'), 'PAYPAL123456')
    await user.click(screen.getByRole('button', { name: 'Submit for manual review' }))

    expect(submitted).toEqual({ serverId: 'server-1', packageCode: 'exclusive_30_day', donorReference: 'PAYPAL123456', turnstileToken: 'verified-challenge-token' })
    expect(await screen.findByText('Your donation claim was submitted for manual review.')).toBeInTheDocument()
    expect(screen.getByText('Your donation claim was submitted for manual review.')).toHaveFocus()
    expect(await screen.findByText('pending')).toBeInTheDocument()
    expect(window.turnstile?.render).toHaveBeenCalledWith(expect.any(HTMLElement),expect.objectContaining({action:'donation-claim',size:'flexible'}))
    expect(window.turnstile?.reset).toHaveBeenCalled()
  })

  it('does not submit a claim until the security check is complete', async () => {
    window.turnstile!.render=vi.fn(()=> 'claim-widget')
    const user = userEvent.setup()
    let submitted = false
    const advertisingService: AdvertisingService = {
      loadWorkspace: () => Promise.resolve({
        servers: [{ id: 'server-1', name: 'Flyff One', gameName: 'Flyff', gameSlug: 'flyff' }],
        packages: [{ code: 'exclusive_7_day', durationDays: 7, tier: 'exclusive', priceMinor: '1000', currency: 'USD' }],
        claims: [],
      }),
      createClaim: () => { submitted = true; return Promise.resolve({ ok: true, message: 'Submitted.',claimId:'123e4567-e89b-42d3-a456-426614174000' }) },
    }
    render(<AdvertisePage authService={readyAuth} advertisingService={advertisingService} turnstileSiteKey="test-key" />)
    await user.selectOptions(await screen.findByLabelText('Approved server', { selector: '#claim-server' }), 'server-1')
    await user.selectOptions(screen.getByLabelText('Placement duration'), 'exclusive_7_day')
    await user.type(screen.getByLabelText('PayPal transaction reference'), 'PAYPAL123456')
    await user.click(screen.getByRole('button', { name: 'Submit for manual review' }))
    expect(submitted).toBe(false)
    expect(screen.getByText('Complete the security check.')).toHaveAttribute('role', 'alert')
    expect(screen.getByRole('group', { name: 'Security check' })).toHaveFocus()
    expect(screen.getByRole('group',{name:'Security check'})).toHaveAccessibleDescription('Complete the security check.')
  })

  it('shows a rejected transaction reference inline and focuses it',async()=>{const user=userEvent.setup();const advertisingService:AdvertisingService={loadWorkspace:()=>Promise.resolve({servers:[{id:'server-1',name:'Flyff One',gameName:'Flyff',gameSlug:'flyff'}],packages:[{code:'exclusive_7_day',durationDays:7,tier:'exclusive',priceMinor:'1000',currency:'USD'}],claims:[]}),createClaim:()=>Promise.resolve({ok:false,message:'This PayPal transaction reference has already been used.',fieldErrors:{donorReference:'Enter a different PayPal transaction reference.'}})};render(<AdvertisePage authService={readyAuth} advertisingService={advertisingService} turnstileSiteKey="test-key"/>);await user.selectOptions(await screen.findByLabelText('Approved server',{selector:'#claim-server'}),'server-1');await user.selectOptions(screen.getByLabelText('Placement duration'),'exclusive_7_day');await user.type(screen.getByLabelText('PayPal transaction reference'),'PAYPAL123456');await user.click(screen.getByRole('button',{name:'Submit for manual review'}));expect(await screen.findByText('Enter a different PayPal transaction reference.')).toHaveAttribute('role','alert');expect(screen.getByLabelText('PayPal transaction reference')).toHaveFocus();expect(screen.getByText('This PayPal transaction reference has already been used.')).toHaveAttribute('role','alert')})

  it('offers the larger exclusive banner upload only for an approved owner server', async () => {
    const advertisingService: AdvertisingService = {
      loadWorkspace: () => Promise.resolve({ servers: [], packages: [], claims: [] }),
      createClaim: () => Promise.resolve({ ok: false, message: 'Not available.' }),
    }
    render(<AdvertisePage authService={readyAuth} advertisingService={advertisingService} turnstileSiteKey="test-key" />)

    expect(await screen.findByRole('heading', { name: 'Upload an exclusive paid banner' })).toBeInTheDocument()
    expect(screen.getByText(/larger banner is used only for approved Exclusive Server advertising/i)).toBeInTheDocument()
    expect(screen.getByText(/need an approved server before uploading/i)).toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/â|Â/)
  })
})
