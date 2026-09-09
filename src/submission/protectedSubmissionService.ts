import { getFirebaseAuth } from '../firebase'
import type { ProtectedServerSubmission, ProtectedSubmissionService } from './types'

type SubmissionResponse = { reference?: unknown }

export const protectedSubmissionService: ProtectedSubmissionService = {
  async submit(submission) {
    try {
      const user = getFirebaseAuth()?.currentUser
      if (!user) return { ok: false, message: 'Sign in to submit a server.' }
      if (!user.emailVerified) return { ok: false, message: 'Verify your email address before submitting a server.' }
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      if (!apiBaseUrl) return { ok: false, message: 'Server submissions are temporarily unavailable.' }
      const idToken = await user.getIdToken(true)
      const response = await submitProtectedServer(apiBaseUrl, submission, { idToken })
      const body = await response.json().catch(() => null) as (SubmissionResponse & { message?: unknown }) | null
      if (!response.ok) return publicSubmissionFailure(response.status, body?.message, response.headers.get('x-request-id'))
      if (typeof body?.reference !== 'string' || body.reference.length < 1 || body.reference.length > 100) {
        return { ok: false, message: 'Your submission could not be confirmed. Please try again.' }
      }
      return { ok: true, reference: body.reference }
    } catch {
      return { ok: false, message: 'Your server could not be submitted. Please try again.' }
    }
  },
}

export function submitProtectedServer(
  apiBaseUrl: string,
  submission: ProtectedServerSubmission,
  credentials: { idToken: string },
  fetcher: typeof fetch = fetch,
) {
  const { banner, bannerAltText, ...server } = submission
  if (banner) {
    const body = new FormData()
    for (const [key, value] of Object.entries(server)) body.append(key, value)
    body.append('banner', banner)
    body.append('bannerAltText', bannerAltText ?? '')
    return fetcher(new URL('/api/server-submissions', apiBaseUrl), {
      method: 'POST', headers: { authorization: `Bearer ${credentials.idToken}` }, body,
    })
  }
  return fetcher(new URL('/api/server-submissions', apiBaseUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${credentials.idToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(server),
  })
}

export function publicSubmissionFailure(status: number, responseMessage?: unknown, requestId?: string | null): Extract<import('./types').SubmissionResult, { ok: false }> {
  if (status === 401) return {
    ok: false,
    message: 'Your account could not be verified. Sign out, then sign in with your verified account and try again.',
  }
  if (status === 400 && responseMessage === 'Choose a valid 468 by 60 pixel GIF, PNG, or JPEG banner.') return {
    ok: false,
    message: responseMessage,
    fieldErrors: { banner: responseMessage },
  }
  if (status === 400 && responseMessage === 'Please choose an available game.') return {
    ok: false,
    message: responseMessage,
    fieldErrors: { gameSlug: responseMessage },
  }
  if (status === 403) return { ok: false, message: 'Complete the security check again.', fieldErrors: { turnstileToken: 'Complete the security check again.' } }
  if (status === 400) return { ok: false, message: 'Check the highlighted fields and try again.' }
  if (status === 409 && responseMessage === 'You already have several submissions pending review.') return { ok: false, message: responseMessage }
  if (status === 409) {
    const message = 'This server is already listed or pending review.'
    return { ok: false, message, fieldErrors: { name: message, website: message } }
  }
  if (status === 429) return { ok: false, message: 'Submissions are temporarily limited. Please wait and try again.' }
  const reference = typeof requestId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ? requestId : null
  return { ok: false, message: `Your server could not be submitted. Please try again.${reference ? ` Support reference: ${reference}` : ''}` }
}
