import { useEffect, useRef, useState, type FormEvent } from 'react'
import logoUrl from '../assets/mmorpg-top-100-logo-web.png'
import { advertiserAuthService } from './advertisingServices'
import { BannerUploadForm } from './BannerUploadForm'
import { ownerBannerWorkspaceService } from './bannerServices'
import type { OwnerBannerWorkspaceService } from './bannerTypes'
import type { AdvertiserAuthService, EligibleServer } from './types'
import './AdvertisePage.css'

type Props = { authService?: AdvertiserAuthService; workspaceService?: OwnerBannerWorkspaceService }

export default function OwnerBannerPage({ authService = advertiserAuthService, workspaceService = ownerBannerWorkspaceService }: Props) {
  const [state, setState] = useState<'checking'|'signed-out'|'verify-email'|'loading'|'ready'|'error'>('checking')
  const [servers, setServers] = useState<EligibleServer[]>([])
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [errors, setErrors] = useState<Record<string,string>>({})
  const [reload, setReload] = useState(0)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    void authService.currentStatus().then((status) => {
      if (!active) return
      if (status !== 'ready') { setState(status); return }
      setState('loading')
      void workspaceService.listServers().then((items) => { if (active) { setServers(items); setState('ready') } }, () => { if (active) setState('error') })
    })
    return () => { active = false }
  }, [authService, reload, workspaceService])

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    const nextErrors: Record<string,string> = {}
    if (!email || !email.includes('@')) nextErrors.email = 'Please enter a valid email address.'
    if (password.length < 8) nextErrors.password = 'Enter a password with at least 8 characters.'
    setErrors(nextErrors); setFeedback('')
    if (nextErrors.email) emailRef.current?.focus()
    else if (nextErrors.password) passwordRef.current?.focus()
    if (Object.keys(nextErrors).length) return
    setPending(true)
    try {
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
      const result = submitter?.value === 'register' ? await authService.register(email,password) : await authService.signIn(email,password)
      setState(result)
      if (result === 'verify-email') setFeedback('Verify your email address before continuing.')
      else setReload((value) => value + 1)
    } catch { setFeedback('The account could not be accessed. Check the details and try again.') }
    finally { setPending(false) }
  }

  async function sendVerification() {
    setPending(true)
    try { await authService.sendVerification(); setFeedback('A new verification email was sent.') }
    catch { setFeedback('The verification email could not be sent.') }
    finally { setPending(false) }
  }

  async function refreshVerification() {
    setPending(true)
    try {
      if (await authService.refreshVerification()) setReload((value) => value + 1)
      else setFeedback('Your email address is not verified yet.')
    } catch { setFeedback('Verification could not be checked.') }
    finally { setPending(false) }
  }

  async function leaveWorkspace() {
    setPending(true)
    try { await authService.signOut(); setServers([]); setFeedback(''); setState('signed-out') }
    catch { setFeedback('The account could not be signed out. Please try again.') }
    finally { setPending(false) }
  }

  return <div className="advertise-page">
    <a className="skip-link" href="#banner-main">Skip to main content</a>
    <header className="advertise-header"><a href="/" aria-label="MMORPG Top 100 home"><img src={logoUrl} alt="MMORPG Top 100" /></a><a href="/">Back to rankings</a></header>
    <main id="banner-main">
      <section className="advertise-intro"><p className="eyebrow">Server owners</p><h1>Manage your server banner</h1><p>Banner upload is free for every approved server owner. Every image is reviewed before it appears publicly.</p></section>
      {state === 'checking' && <p role="status">Checking your account...</p>}
      {state === 'loading' && <p role="status">Loading your approved servers...</p>}
      {state === 'error' && <section className="owner-workspace-error"><p role="alert">Your approved servers are unavailable right now. Please try again later.</p><div className="advertiser-auth-actions"><button type="button" disabled={pending} onClick={() => setReload((value) => value + 1)}>Retry</button><button type="button" disabled={pending} onClick={() => void leaveWorkspace()}>Sign out</button></div>{feedback && <p role="status">{feedback}</p>}</section>}
      {state === 'signed-out' && <section className="advertiser-auth" aria-labelledby="owner-account-heading"><h2 id="owner-account-heading">Server owner account</h2><p>Sign in with the same account used to submit your server. New accounts can manage servers submitted and approved under that account.</p><form onSubmit={(event) => void authenticate(event)} noValidate><label htmlFor="owner-email">Email address</label><input ref={emailRef} id="owner-email" name="email" type="email" autoComplete="username" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'owner-email-error' : undefined}/>{errors.email && <p id="owner-email-error" className="field-error">{errors.email}</p>}<label htmlFor="owner-password">Password</label><input ref={passwordRef} id="owner-password" name="password" type="password" minLength={8} autoComplete="current-password" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'owner-password-error' : undefined}/>{errors.password && <p id="owner-password-error" className="field-error">{errors.password}</p>}<div className="advertiser-auth-actions"><button type="submit" value="sign-in" disabled={pending}>Sign in</button><button type="submit" value="register" disabled={pending}>Create account</button></div></form>{feedback && <p role="status">{feedback}</p>}</section>}
      {state === 'verify-email' && <section className="advertiser-auth" aria-labelledby="verify-owner-heading"><h2 id="verify-owner-heading">Verify your email address</h2><p>Use the link in your verification email, then return here.</p><div className="advertiser-auth-actions"><button type="button" disabled={pending} onClick={() => void sendVerification()}>Send another email</button><button type="button" disabled={pending} onClick={() => void refreshVerification()}>I have verified my email</button></div>{feedback && <p role="status">{feedback}</p>}</section>}
      {state === 'ready' && <><BannerUploadForm servers={servers}/><button className="owner-workspace-signout" type="button" disabled={pending} onClick={() => void leaveWorkspace()}>Sign out</button></>}
    </main>
  </div>
}
