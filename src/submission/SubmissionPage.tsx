import { cloneElement, useCallback, useRef, useState, type FormEvent } from 'react'
import { games } from '../games/games'
import { PlayerAuthPanel } from '../voting/PlayerAuthPanel'
import type { PlayerAuthService, PlayerAuthStatus } from '../voting/playerAuthService'
import { TurnstileWidget, type TurnstileWidgetHandle } from '../voting/TurnstileWidget'
import { protectedSubmissionService } from './protectedSubmissionService'
import { validateSubmission, type SubmissionErrors } from './submissionValidation'
import type { ProtectedServerSubmission, ProtectedSubmissionService } from './types'

type FieldName = keyof Omit<ProtectedServerSubmission, 'turnstileToken'> | 'turnstileToken'

export function SubmissionPage({ service = protectedSubmissionService, turnstileSiteKey, authService }: {
  service?: ProtectedSubmissionService
  turnstileSiteKey?: string
  authService?: PlayerAuthService
}) {
  const [errors, setErrors] = useState<SubmissionErrors>({})
  const [token, setToken] = useState('')
  const [pending, setPending] = useState(false)
  const [feedback, setFeedback] = useState<{ message: string; kind: 'success' | 'error' } | null>(null)
  const [authStatus, setAuthStatus] = useState<PlayerAuthStatus>('signed-out')
  const formRef = useRef<HTMLFormElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLParagraphElement>(null)
  const widgetRef = useRef<TurnstileWidgetHandle>(null)
  const receiveToken = useCallback((value: string) => setToken(value), [])
  const receiveAuthStatus = useCallback((value: PlayerAuthStatus) => setAuthStatus(value), [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const data = new FormData(form)
    const bannerEntry = bannerRef.current?.files?.[0]
    const banner = bannerEntry && bannerEntry.size > 0 ? bannerEntry : undefined
    const submission: ProtectedServerSubmission = {
      name: String(data.get('name') ?? '').trim(),
      website: String(data.get('website') ?? '').trim(),
      gameSlug: String(data.get('gameSlug') ?? ''),
      gameVersion: String(data.get('gameVersion') ?? '').trim(),
      region: String(data.get('region') ?? '').trim(),
      mode: String(data.get('mode') ?? '') as ProtectedServerSubmission['mode'],
      description: String(data.get('description') ?? '').trim(),
      turnstileToken: token,
      banner,
      bannerAltText: String(data.get('bannerAltText') ?? '').trim() || undefined,
    }
    const nextErrors = validateSubmission(submission)
    setErrors(nextErrors)
    setFeedback(null)
    const firstError = Object.keys(nextErrors)[0] as FieldName | undefined
    if (firstError) {
      if (firstError === 'turnstileToken') formRef.current?.querySelector<HTMLElement>('[aria-labelledby="submission-security-label"]')?.focus()
      else {
        const field = formRef.current?.elements.namedItem(firstError)
        if (field instanceof HTMLElement) field.focus()
      }
      return
    }
    if (banner && !await hasRequiredBannerDimensions(banner)) {
      setErrors({ banner: 'Choose a banner that is exactly 468 by 60 pixels.' })
      const field = formRef.current?.elements.namedItem('banner')
      if (field instanceof HTMLElement) field.focus()
      return
    }
    setPending(true)
    const result = await service.submit(submission)
    setPending(false)
    widgetRef.current?.reset()
    if (result.ok) {
      form.reset()
      setErrors({})
      setFeedback({ message: `Your server was submitted for review. Reference: ${result.reference}`, kind: 'success' })
    } else {
      if (result.fieldErrors) setErrors((current) => ({ ...current, ...result.fieldErrors }))
      setFeedback({ message: result.message, kind: 'error' })
    }
    requestAnimationFrame(() => {
      if (!result.ok && result.fieldErrors) {
        const firstField = Object.keys(result.fieldErrors)[0] as FieldName | undefined
        if (firstField === 'turnstileToken') formRef.current?.querySelector<HTMLElement>('[aria-labelledby="submission-security-label"]')?.focus()
        else if (firstField) {
          const field = formRef.current?.elements.namedItem(firstField)
          if (field instanceof HTMLElement) field.focus()
        }
      } else resultRef.current?.focus()
    })
  }

  function clearFieldError(event: FormEvent<HTMLFormElement>) {
    const field = event.target
    if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) return
    const name = field.name as FieldName
    if (errors[name]) setErrors((current) => { const next = { ...current }; delete next[name]; return next })
    if (feedback?.kind === 'error') setFeedback(null)
  }

  const errorCount = Object.keys(errors).length

  return <main className="submission-page">
    <section aria-labelledby="submission-heading">
      <h1 id="submission-heading">Submit your server</h1>
      <p>Send an active private server for manual review. Submission does not guarantee approval or affect ranking.</p>
      <PlayerAuthPanel service={authService} onStatusChange={receiveAuthStatus} purpose="submit" />
      {authStatus === 'ready' && <form ref={formRef} onSubmit={(event) => void submit(event)} onInput={clearFieldError} noValidate>
        {errorCount > 0 && <div className="submission-error-summary" role="alert" aria-live="assertive">
          <strong>Please correct {errorCount === 1 ? 'the highlighted field' : `${errorCount} highlighted fields`}.</strong>
          <span>Each error is explained beside its field.</span>
        </div>}
        <SubmissionField id="server-name" name="name" label="Server name" error={errors.name}><input id="server-name" name="name" type="text" required minLength={2} maxLength={80} autoComplete="organization" /></SubmissionField>
        <SubmissionField id="server-website" name="website" label="Server website" error={errors.website}><input id="server-website" name="website" type="url" required inputMode="url" maxLength={2048} autoComplete="url" placeholder="https://example.com" /></SubmissionField>
        <SubmissionField id="server-game" name="gameSlug" label="Game" error={errors.gameSlug}><select id="server-game" name="gameSlug" required defaultValue=""><option value="" disabled>Select a game</option>{games.map((game) => <option key={game.slug} value={game.slug}>{game.name}</option>)}</select></SubmissionField>
        <SubmissionField id="game-version" name="gameVersion" label="Game version" error={errors.gameVersion}><input id="game-version" name="gameVersion" type="text" required maxLength={60} placeholder="For example: v22" /></SubmissionField>
        <SubmissionField id="server-region" name="region" label="Primary region" error={errors.region}><input id="server-region" name="region" type="text" required maxLength={60} autoComplete="country-name" placeholder="For example: Southeast Asia" /></SubmissionField>
        <SubmissionField id="server-mode" name="mode" label="Server mode" error={errors.mode}><select id="server-mode" name="mode" required defaultValue=""><option value="" disabled>Select a mode</option><option value="PvE">PvE</option><option value="PvP">PvP</option><option value="RPG">RPG</option></select></SubmissionField>
        <SubmissionField id="server-description" name="description" label="Description" error={errors.description}><textarea id="server-description" name="description" required minLength={20} maxLength={1000} rows={6} /></SubmissionField>
        <fieldset>
          <legend>Banner (optional and free)</legend>
          <p id="banner-help">Upload a 468 by 60 pixel GIF, PNG, or JPEG up to 512 KB. If you choose one, its description is required. It will be reviewed separately and will not affect your rank.</p>
          <SubmissionField id="server-banner" name="banner" label="Banner image" error={errors.banner}><input ref={bannerRef} id="server-banner" name="banner" type="file" accept="image/gif,image/png,image/jpeg" aria-describedby={errors.banner ? 'banner-error' : 'banner-help'} /></SubmissionField>
          <SubmissionField id="banner-alt-text" name="bannerAltText" label="Banner description" error={errors.bannerAltText}><input id="banner-alt-text" name="bannerAltText" type="text" minLength={10} maxLength={160} aria-describedby="banner-help" placeholder="Describe the banner for visitors who cannot see it" /></SubmissionField>
        </fieldset>
        <div tabIndex={-1} aria-labelledby="submission-security-label"><TurnstileWidget onToken={receiveToken} resetRef={widgetRef} siteKey={turnstileSiteKey} action="submit-server" idPrefix="submission" /></div>
        {errors.turnstileToken && <p id="turnstileToken-error" className="field-error" role="alert">{errors.turnstileToken}</p>}
        <button type="submit" disabled={pending}>{pending ? 'Submitting…' : 'Submit for review'}</button>
        {feedback && <p ref={resultRef} tabIndex={-1} className={`submission-result ${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.message}</p>}
      </form>}
    </section>
  </main>
}

async function hasRequiredBannerDimensions(file: File) {
  try {
    const bitmap = await createImageBitmap(file)
    const valid = bitmap.width === 468 && bitmap.height === 60
    bitmap.close()
    return valid
  } catch {
    return false
  }
}

function SubmissionField({ id, name, label, error, children }: { id: string; name: FieldName; label: string; error?: string; children: React.ReactElement<{ 'aria-invalid'?: boolean; 'aria-describedby'?: string }> }) {
  const child = cloneElement(children, {
    'aria-invalid': Boolean(error),
    'aria-describedby': [children.props['aria-describedby'], error ? `${name}-error` : ''].filter(Boolean).join(' ') || undefined,
  })
  return <div className="submission-field"><label htmlFor={id}>{label}</label>{child}{error && <p id={`${name}-error`} className="field-error" role="alert">{error}</p>}</div>
}
