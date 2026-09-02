type TurnstileResult = {
  success?: boolean
  hostname?: string
  action?: string
}

export function createTurnstileVerifier(secret: string, expectedHostname: string, expectedAction: string, fetcher: typeof fetch = fetch) {
  return async (token: string, remoteIp?: string): Promise<boolean> => {
    if (!token || token.length > 2048) return false
    const body = new URLSearchParams({ secret, response: token, idempotency_key: crypto.randomUUID() })
    if (remoteIp) body.set('remoteip', remoteIp)
    try {
      const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(5000),
      })
      if (!response.ok) return false
      const result = await response.json<TurnstileResult>()
      return result.success === true && result.hostname === expectedHostname && result.action === expectedAction
    } catch {
      return false
    }
  }
}
