import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminPage from './AdminPage'
import type { AdminAccessService, AdminAuthService, DonationClaimReviewService, ModerationItem, ModerationService } from './types'

const pendingItem: ModerationItem = {
  id: 'submission-1',
  name: 'Moonlight Realms',
  website: 'https://moonlight.example/',
  gameVersion: '1.0',
  region: 'Asia',
  mode: 'PvE',
  description: 'A friendly raid community.',
  submittedAt: '2026-08-30T00:00:00.000Z',
  status: 'pending',
}

const authService: AdminAuthService = {
  signIn: () => Promise.resolve('ready'),
  sendVerification: () => Promise.resolve(),
  refreshVerification: () => Promise.resolve(true),
  signOut: () => Promise.resolve(),
}

const emptyDonationService: DonationClaimReviewService = {
  listPending: () => Promise.resolve([]),
  decide: () => Promise.resolve({ ok: false, message: 'Not available.' }),
}

describe('AdminPage', () => {
  it('does not load moderation data when access is denied', async () => {
    const accessService: AdminAccessService = { canModerate: () => Promise.resolve(false) }
    let listWasCalled = false
    const moderationService: ModerationService = {
      listPending: () => {
        listWasCalled = true
        return Promise.resolve([])
      },
      decide: () => Promise.resolve({ ok: false, message: 'Not available.' }),
    }

    render(<AdminPage accessService={accessService} moderationService={moderationService} donationClaimReviewService={emptyDonationService} />)

    expect(await screen.findByRole('heading', { name: 'Administrator sign in' })).toBeInTheDocument()
    expect(listWasCalled).toBe(false)
  })

  it('checks access again after a successful sign in', async () => {
    const user = userEvent.setup()
    let checks = 0
    const accessService: AdminAccessService = {
      canModerate: () => Promise.resolve(++checks > 1),
    }
    const moderationService: ModerationService = {
      listPending: () => Promise.resolve([]),
      decide: () => Promise.resolve({ ok: false, message: 'Not available.' }),
    }

    render(
      <AdminPage
        accessService={accessService}
        authService={authService}
        moderationService={moderationService}
        donationClaimReviewService={emptyDonationService}
      />,
    )

    await user.type(await screen.findByLabelText('Email address'), 'admin@example.com')
    await user.type(screen.getByLabelText('Password'), 'secure password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('There are no pending reviews.')).toBeInTheDocument()
    expect(checks).toBe(2)
  })

  it('allows an authorized moderator to approve a pending submission', async () => {
    const user = userEvent.setup()
    const accessService: AdminAccessService = { canModerate: () => Promise.resolve(true) }
    const moderationService: ModerationService = {
      listPending: () => Promise.resolve([pendingItem]),
      decide: () => Promise.resolve({ ok: true, message: 'The listing was approved.' }),
    }

    render(<AdminPage accessService={accessService} moderationService={moderationService} donationClaimReviewService={emptyDonationService} />)

    expect(await screen.findByText('Moonlight Realms')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Approve Moonlight Realms' }))
    expect(screen.getByRole('alertdialog', { name: 'Confirm approve' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm approval' }))

    expect(await screen.findByText('The listing was approved.')).toBeInTheDocument()
    expect(screen.queryByText('Moonlight Realms')).not.toBeInTheDocument()
  })

  it('returns focus to the decision button when confirmation is cancelled', async () => {
    const user = userEvent.setup()
    const moderationService: ModerationService = { listPending: () => Promise.resolve([pendingItem]), decide: vi.fn() }
    render(<AdminPage accessService={{ canModerate: () => Promise.resolve(true) }} moderationService={moderationService} donationClaimReviewService={emptyDonationService} />)
    const reject = await screen.findByRole('button', { name: 'Reject Moonlight Realms' })
    await user.click(reject)
    expect(screen.getByRole('button', { name: 'Confirm rejection' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(reject).toHaveFocus())
    expect(moderationService.decide).not.toHaveBeenCalled()
  })

  it('allows an authorized administrator to verify a matched donation claim', async () => {
    const user = userEvent.setup()
    const accessService: AdminAccessService = { canModerate: () => Promise.resolve(true) }
    const moderationService: ModerationService = { listPending: () => Promise.resolve([]), decide: () => Promise.resolve({ ok: false, message: 'Not available.' }) }
    const donationClaimReviewService: DonationClaimReviewService = {
      listPending: () => Promise.resolve([{ id: 'claim-1', serverName: 'Flyff One', gameName: 'Flyff', website: 'https://flyff.example', donorReference: 'PAYPAL123456', durationDays: 7, expectedAmountMinor: '900', currency: 'USD', createdAt: '2026-08-30T00:00:00Z' }]),
      decide: () => Promise.resolve({ ok: true, message: 'The donation claim was verified.' }),
    }
    render(<AdminPage accessService={accessService} moderationService={moderationService} donationClaimReviewService={donationClaimReviewService} />)

    expect(await screen.findByText('PAYPAL123456')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Verify donation match for Flyff One' }))
    expect(await screen.findByText('The donation claim was verified.')).toBeInTheDocument()
    expect(screen.queryByText('PAYPAL123456')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Moderation workspace' })).toHaveFocus()
  })
})
