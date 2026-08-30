import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  adminAccessService as defaultAccessService,
  adminAuthService as defaultAuthService,
  moderationService as defaultModerationService,
  donationClaimReviewService as defaultDonationClaimReviewService,
} from './adminServices'
import type { AdminAccessService, AdminAuthService, DonationClaimReviewItem, DonationClaimReviewService, ModerationItem, ModerationService } from './types'
import './AdminPage.css'

type AdminPageProps = {
  accessService?: AdminAccessService
  authService?: AdminAuthService
  moderationService?: ModerationService
  donationClaimReviewService?: DonationClaimReviewService
}

export default function AdminPage({
  accessService = defaultAccessService,
  authService = defaultAuthService,
  moderationService = defaultModerationService,
  donationClaimReviewService = defaultDonationClaimReviewService,
}: AdminPageProps) {
  const [state, setState] = useState<'checking' | 'denied' | 'ready' | 'error'>('checking')
  const [items, setItems] = useState<ModerationItem[]>([])
  const [donationClaims, setDonationClaims] = useState<DonationClaimReviewItem[]>([])
  const [feedback, setFeedback] = useState('')
  const [pendingId, setPendingId] = useState('')
  const [authPending, setAuthPending] = useState(false)
  const [authFeedback, setAuthFeedback] = useState('')
  const [needsVerification, setNeedsVerification] = useState(false)
  const [accessCheck, setAccessCheck] = useState(0)
  const [focusAfterDecision, setFocusAfterDecision] = useState(0)
  const workspaceHeadingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (focusAfterDecision === 0) return
    workspaceHeadingRef.current?.focus()
  }, [focusAfterDecision])

  useEffect(() => {
    let active = true
    accessService.canModerate().then(async (allowed) => {
      if (!active) return
      if (!allowed) {
        setState('denied')
        return
      }
      try {
        const [pendingItems, pendingDonationClaims] = await Promise.all([
          moderationService.listPending(),
          donationClaimReviewService.listPending(),
        ])
        if (active) {
          setItems(pendingItems)
          setDonationClaims(pendingDonationClaims)
          setState('ready')
        }
      } catch {
        if (active) setState('error')
      }
    }, () => {
      if (active) setState('denied')
    })
    return () => {
      active = false
    }
  }, [accessCheck, accessService, donationClaimReviewService, moderationService])

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    setAuthFeedback('')
    if (!email || !password) {
      setAuthFeedback('Enter your email address and password.')
      return
    }
    setAuthPending(true)
    try {
      const result = await authService.signIn(email, password)
      if (result === 'verify-email') {
        setNeedsVerification(true)
        setAuthFeedback('Verify your email address before continuing.')
      } else {
        setNeedsVerification(false)
        setState('checking')
        setAccessCheck((value) => value + 1)
      }
    } catch {
      setAuthFeedback('The email address or password is incorrect.')
    } finally {
      setAuthPending(false)
    }
  }

  const sendVerificationMessage = async () => {
    setAuthPending(true)
    try {
      await authService.sendVerification()
      setAuthFeedback('A verification email has been sent. Check your inbox and spam folder.')
    } catch {
      setAuthFeedback('The verification email could not be sent. Please try again later.')
    } finally {
      setAuthPending(false)
    }
  }

  const confirmVerification = async () => {
    setAuthPending(true)
    try {
      if (await authService.refreshVerification()) {
        setNeedsVerification(false)
        setState('checking')
        setAccessCheck((value) => value + 1)
      } else {
        setAuthFeedback('Your email address has not been verified yet.')
      }
    } catch {
      setAuthFeedback('Verification could not be checked. Please try again.')
    } finally {
      setAuthPending(false)
    }
  }

  const handleSignOut = async () => {
    await authService.signOut()
    setItems([])
    setNeedsVerification(false)
    setAuthFeedback('')
    setState('denied')
  }

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setPendingId(id)
    setFeedback('')
    try {
      const result = await moderationService.decide(id, decision)
      setFeedback(result.message)
      if (result.ok) {
        setItems((currentItems) => currentItems.filter((item) => item.id !== id))
        setFocusAfterDecision((value) => value + 1)
      }
    } catch {
      setFeedback('The moderation decision could not be saved. Please try again.')
    } finally {
      setPendingId('')
    }
  }

  const decideDonationClaim = async (claim: DonationClaimReviewItem, decision: 'verify' | 'reject') => {
    setPendingId(claim.id)
    setFeedback('')
    try {
      const result = await donationClaimReviewService.decide({
        id: claim.id,
        decision,
        expectedAmountMinor: claim.expectedAmountMinor,
        currency: claim.currency,
        reasonCode: decision === 'reject' ? 'not_matched' : undefined,
      })
      setFeedback(result.message)
      if (result.ok) {
        setDonationClaims((current) => current.filter((item) => item.id !== claim.id))
        setFocusAfterDecision((value) => value + 1)
      }
    } catch {
      setFeedback('The donation decision could not be saved. Please try again.')
    } finally {
      setPendingId('')
    }
  }

  return (
    <main className="admin-shell">
      <a href="/" className="admin-back">Back to rankings</a>
      <p className="eyebrow">Restricted area</p>
      <h1 ref={workspaceHeadingRef} tabIndex={-1}>Moderation workspace</h1>
      {state === 'checking' && <p role="status">Checking access...</p>}
      {state === 'denied' && (
        <section className="admin-auth" aria-labelledby="admin-sign-in-heading">
          <h2 id="admin-sign-in-heading">Administrator sign in</h2>
          {!needsVerification ? (
            <form onSubmit={(event) => void handleSignIn(event)} noValidate>
              <label htmlFor="admin-email">Email address</label>
              <input id="admin-email" name="email" type="email" autoComplete="username" />
              <label htmlFor="admin-password">Password</label>
              <input id="admin-password" name="password" type="password" autoComplete="current-password" />
              <button type="submit" disabled={authPending}>
                {authPending ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          ) : (
            <div className="verification-actions">
              <button type="button" disabled={authPending} onClick={() => void sendVerificationMessage()}>
                Send verification email
              </button>
              <button type="button" disabled={authPending} onClick={() => void confirmVerification()}>
                I have verified my email
              </button>
            </div>
          )}
          {authFeedback && <p className="auth-feedback" role="status">{authFeedback}</p>}
        </section>
      )}
      {state === 'error' && <p role="alert">Submissions are unavailable right now. Please try again later.</p>}
      {state === 'ready' && items.length === 0 && donationClaims.length === 0 && <p role="status">There are no pending reviews.</p>}
      {state === 'ready' && (
        <button type="button" className="sign-out-button" onClick={() => void handleSignOut()}>
          Sign out
        </button>
      )}
      {state === 'ready' && items.length > 0 && (
        <section aria-labelledby="submission-review-heading">
          <h2 id="submission-review-heading">Pending server submissions</h2>
          <div className="moderation-list" role="list" aria-label="Pending submissions">
          {items.map((item) => (
            <article key={item.id} className="moderation-card" role="listitem">
              <div>
                <p className="moderation-meta">{item.mode} | {item.region}</p>
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <a href={item.website} target="_blank" rel="noopener noreferrer">Review website <span className="visually-hidden">(opens in a new tab)</span></a>
              </div>
              <div className="moderation-actions">
                <button aria-label={`Approve ${item.name}`} disabled={pendingId === item.id} onClick={() => void decide(item.id, 'approve')}>Approve</button>
                <button aria-label={`Reject ${item.name}`} disabled={pendingId === item.id} onClick={() => void decide(item.id, 'reject')}>Reject</button>
              </div>
            </article>
          ))}
          </div>
        </section>
      )}
      {state === 'ready' && donationClaims.length > 0 && (
        <section aria-labelledby="donation-review-heading">
          <h2 id="donation-review-heading">Pending donation claims</h2>
          <div className="moderation-list" role="list" aria-label="Pending donation claims">
            {donationClaims.map((claim) => (
              <article key={claim.id} className="moderation-card donation-review-card" role="listitem">
                <div>
                  <p className="moderation-meta">{claim.gameName} | {claim.durationDays} days</p>
                  <h3>{claim.serverName}</h3>
                  <p><strong>Expected:</strong> {formatMoney(claim.expectedAmountMinor, claim.currency)}</p>
                  <p><strong>PayPal reference:</strong> <code>{claim.donorReference}</code></p>
                  <a href={claim.website} target="_blank" rel="noopener noreferrer">Review server website <span className="visually-hidden">(opens in a new tab)</span></a>
                </div>
                <div className="moderation-actions">
                  <button aria-label={`Verify donation match for ${claim.serverName}`} disabled={pendingId === claim.id} onClick={() => void decideDonationClaim(claim, 'verify')}>Verify match</button>
                  <button aria-label={`Reject donation claim for ${claim.serverName}`} disabled={pendingId === claim.id} onClick={() => void decideDonationClaim(claim, 'reject')}>Reject claim</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {feedback && <p className="admin-feedback" role="status">{feedback}</p>}
    </main>
  )
}

function formatMoney(amountMinor: string, currency: string) {
  const amount = Number(amountMinor) / 100
  if (!Number.isFinite(amount)) return `${currency} amount unavailable`
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount)
}
