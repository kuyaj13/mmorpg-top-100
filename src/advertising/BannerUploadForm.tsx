import { useCallback, useRef, useState, type FormEvent } from 'react'
import { TurnstileWidget, type TurnstileWidgetHandle } from '../voting/TurnstileWidget'
import { bannerUploadService } from './bannerServices'
import type { BannerUploadFormProps } from './bannerTypes'

const maximumBytes = 512 * 1024
const allowedTypes = new Set(['image/gif', 'image/png', 'image/jpeg'])

export function BannerUploadForm({ servers, service = bannerUploadService, turnstileSiteKey }: BannerUploadFormProps) {
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const serverRef = useRef<HTMLSelectElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const altRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLParagraphElement>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetRef = useRef<TurnstileWidgetHandle>(null)
  const receiveTurnstileToken = useCallback((token: string) => setTurnstileToken(token), [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const data = new FormData(form)
    const serverId = String(data.get('serverId') ?? '')
    const altText = String(data.get('altText') ?? '').trim()
    const file = fileRef.current?.files?.[0]
    const nextErrors: Record<string, string> = {}
    if (!servers.some((server) => server.id === serverId)) nextErrors.serverId = 'Select one of your approved servers.'
    if (!file || file.size === 0) nextErrors.file = 'Choose a banner image.'
    else if (!allowedTypes.has(file.type) || file.size > maximumBytes) nextErrors.file = 'Choose a GIF, PNG, or JPEG image no larger than 512 KiB.'
    if (altText.length < 10 || altText.length > 160) nextErrors.altText = 'Describe the banner in 10 to 160 characters.'
    if (!turnstileToken) nextErrors.turnstileToken = 'Complete the security check.'
    setErrors(nextErrors); setFeedback('')
    if (nextErrors.serverId) serverRef.current?.focus()
    else if (nextErrors.file) fileRef.current?.focus()
    else if (nextErrors.altText) altRef.current?.focus()
    else if (nextErrors.turnstileToken) turnstileRef.current?.focus()
    if (Object.keys(nextErrors).length || !file) return
    if (!await hasRequiredDimensions(file)) {
      setErrors({ file: 'Choose a banner that is exactly 468 by 60 pixels.' })
      fileRef.current?.focus()
      return
    }
    setPending(true)
    const result = await service.upload({ serverId, altText, file, turnstileToken })
    turnstileWidgetRef.current?.reset()
    setPending(false); setFeedback(result.message)
    if (result.ok) form.reset()
    requestAnimationFrame(() => resultRef.current?.focus())
  }

  return <section className="banner-upload" aria-labelledby="banner-upload-heading">
    <h2 id="banner-upload-heading">Upload a server banner</h2>
    <p>Banner upload is free for every approved server owner. Images require moderation before display.</p>
    {servers.length === 0 ? <p role="status">You need an approved server before uploading a banner.</p> : <form onSubmit={(event) => void submit(event)} noValidate>
      <label htmlFor="banner-server">Approved server</label>
      <select ref={serverRef} id="banner-server" name="serverId" defaultValue="" aria-invalid={Boolean(errors.serverId)} aria-describedby={errors.serverId ? 'banner-server-error' : undefined}><option value="" disabled>Select a server</option>{servers.map((server) => <option key={server.id} value={server.id}>{server.name} — {server.gameName}</option>)}</select>
      {errors.serverId && <p id="banner-server-error">{errors.serverId}</p>}
      <label htmlFor="banner-file">Banner image</label>
      <input ref={fileRef} id="banner-file" name="banner" type="file" required accept="image/gif,image/png,image/jpeg,.gif,.png,.jpg,.jpeg" aria-invalid={Boolean(errors.file)} aria-describedby={`banner-requirements${errors.file ? ' banner-file-error' : ''}`} />
      <p id="banner-requirements">Exactly 468 by 60 pixels; GIF, PNG, or JPEG; maximum 512 KiB. Animated banners require a reduced-motion alternative during moderation.</p>
      {errors.file && <p id="banner-file-error">{errors.file}</p>}
      <label htmlFor="banner-alt">Banner description</label>
      <input ref={altRef} id="banner-alt" name="altText" type="text" required minLength={10} maxLength={160} aria-invalid={Boolean(errors.altText)} aria-describedby={errors.altText ? 'banner-alt-error' : undefined} />
      {errors.altText && <p id="banner-alt-error">{errors.altText}</p>}
      <div ref={turnstileRef} tabIndex={-1}><TurnstileWidget onToken={receiveTurnstileToken} resetRef={turnstileWidgetRef} siteKey={turnstileSiteKey} action="banner-upload" idPrefix="banner" label="Banner security check" /></div>
      {errors.turnstileToken && <p id="banner-security-error" className="field-error" role="alert">{errors.turnstileToken}</p>}
      <button type="submit" disabled={pending}>{pending ? 'Uploading…' : 'Upload for review'}</button>
      {feedback && <p ref={resultRef} tabIndex={-1} role="status">{feedback}</p>}
    </form>}
  </section>
}

async function hasRequiredDimensions(file: File) {
  try {
    const bitmap = await createImageBitmap(file)
    const valid = bitmap.width === 468 && bitmap.height === 60
    bitmap.close()
    return valid
  } catch { return false }
}
