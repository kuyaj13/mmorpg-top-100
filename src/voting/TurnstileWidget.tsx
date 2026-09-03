import { useEffect, useRef, useState } from 'react'

type TurnstileApi = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  remove: (widgetId: string) => void
  reset: (widgetId: string) => void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let scriptPromise: Promise<void> | undefined

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  const loading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script]')
    const script = existing ?? document.createElement('script')
    const loaded = () => window.turnstile ? resolve() : reject(new Error('Security check unavailable'))
    script.addEventListener('load', loaded, { once: true })
    script.addEventListener('error', () => reject(new Error('Security check unavailable')), { once: true })
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.turnstileScript = 'true'
      document.head.append(script)
    }
  }).catch((error: unknown) => {
    scriptPromise = undefined
    throw error
  })
  scriptPromise = loading
  return loading
}

export type TurnstileWidgetHandle = { reset: () => void }

export function TurnstileWidget({ onToken, resetRef, siteKey: configuredSiteKey, action = 'vote', idPrefix = 'vote', label = 'Security check' }: {
  onToken: (token: string) => void
  resetRef?: React.RefObject<TurnstileWidgetHandle | null>
  siteKey?: string
  action?: string
  idPrefix?: string
  label?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [error, setError] = useState('')
  const siteKey = configuredSiteKey ?? import.meta.env.VITE_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (resetRef) resetRef.current = { reset: () => {
      onToken('')
      if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current)
    } }
    if (!siteKey || !containerRef.current) {
      setError('The security check is temporarily unavailable.')
      return
    }
    let cancelled = false
    void loadTurnstile().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        size: 'flexible',
        action,
        callback: (token: string) => { setError(''); onToken(token) },
        'expired-callback': () => onToken(''),
        'timeout-callback': () => onToken(''),
        'error-callback': () => { onToken(''); setError('The security check could not be completed. Please try again.'); return true },
      })
    }).catch(() => { if (!cancelled) setError('The security check is temporarily unavailable.') })
    return () => {
      cancelled = true
      if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current)
      widgetIdRef.current = null
      if (resetRef) resetRef.current = null
    }
  }, [action, onToken, resetRef, siteKey])

  return <div role="group" aria-labelledby={`${idPrefix}-security-label`} aria-describedby={error ? `${idPrefix}-security-error` : undefined}>
    <p id={`${idPrefix}-security-label`}>{label}</p>
    <div ref={containerRef} />
    {error && <p id={`${idPrefix}-security-error`} role="alert">{error}</p>}
  </div>
}
