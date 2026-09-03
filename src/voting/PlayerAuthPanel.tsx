import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { playerAuthService, type PlayerAuthService, type PlayerAuthStatus } from './playerAuthService'

export function PlayerAuthPanel({ service = playerAuthService, onStatusChange, purpose = 'vote' }: { service?: PlayerAuthService; onStatusChange(status: PlayerAuthStatus): void; purpose?: 'vote' | 'submit' }) {
  const [status, setStatus] = useState<PlayerAuthStatus | 'loading'>('loading')
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const emailRef = useRef<HTMLInputElement>(null)
  const update = useCallback((next: PlayerAuthStatus) => { setStatus(next); onStatusChange(next) }, [onStatusChange])

  useEffect(() => { let active = true; service.currentStatus().then((next) => { if (active) update(next) }, () => { if (active) { update('signed-out'); setFeedback('Player sign-in is unavailable right now.') } }); return () => { active = false } }, [service, update])

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return
    const form = new FormData(event.currentTarget); const email = String(form.get('email') ?? '').trim(); const password = String(form.get('password') ?? '')
    if (!email || !password) { setFeedback('Enter your email address and password.'); emailRef.current?.focus(); return }
    setPending(true); setFeedback('')
    try { const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null; const registering = submitter?.value === 'register'; update(registering ? await service.register(email, password) : await service.signIn(email, password)); if (registering) setFeedback('Check your email for a verification link.') }
    catch { setFeedback('Sign-in could not be completed. Check your details and try again.') } finally { setPending(false) }
  }

  async function sendVerificationMessage() { setPending(true); setFeedback(''); try { await service.sendVerification(); setFeedback('A new verification email was sent.') } catch { setFeedback('The verification email could not be sent. Please try again.') } finally { setPending(false) } }
  async function confirmVerification() { setPending(true); setFeedback(''); try { if (await service.refreshVerification()) update('ready'); else setFeedback('Your email address is not verified yet.') } catch { setFeedback('Verification could not be confirmed. Please try again.') } finally { setPending(false) } }

  if (status === 'loading') return <p role="status">Checking player account...</p>
  if (status === 'ready') return <div className="player-auth-ready"><p>Signed in with a verified player account.</p><button type="button" onClick={() => void service.signOut().then(() => update('signed-out'))}>Sign out</button></div>
  const activity = purpose === 'submit' ? 'submitting a server' : 'voting'
  if (status === 'verify-email') return <div className="player-auth-panel"><p>Verify your email address before {activity}.</p><div className="player-auth-actions"><button type="button" disabled={pending} onClick={() => void sendVerificationMessage()}>Send another email</button><button type="button" disabled={pending} onClick={() => void confirmVerification()}>I have verified my email</button></div>{feedback && <p role="status">{feedback}</p>}</div>
  return <form className="player-auth-panel" onSubmit={(event) => void authenticate(event)} noValidate><p>Sign in or create a free player account before {activity}.</p><label htmlFor="player-email">Email address</label><input ref={emailRef} id="player-email" name="email" type="email" autoComplete="username" /><label htmlFor="player-password">Password</label><input id="player-password" name="password" type="password" minLength={8} autoComplete="current-password" /><div className="player-auth-actions"><button type="submit" value="sign-in" disabled={pending}>Sign in</button><button type="submit" value="register" disabled={pending}>Create account</button></div>{feedback && <p role="status">{feedback}</p>}</form>
}
