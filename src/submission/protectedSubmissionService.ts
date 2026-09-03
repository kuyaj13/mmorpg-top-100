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
      const idToken = await user.getIdToken()
      const response = await submitProtectedServer(apiBaseUrl, submission, { idToken })
      const body = await response.json().catch(() => null) as SubmissionResponse | null
      if (!response.ok) return { ok: false, message: publicSubmissionError(response.status) }
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
  const { turnstileToken, ...server } = submission
  return fetcher(new URL('/api/server-submissions', apiBaseUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${credentials.idToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ...server, turnstileToken }),
  })
}

function publicSubmissionError(status: number): string {
  if (status === 401) return 'Sign in with a verified account to submit a server.'
  if (status === 400 || status === 403) return 'Check the form and complete the security check again.'
  if (status === 409) return 'This server is already pending review.'
  if (status === 429) return 'Submissions are temporarily limited. Please wait and try again.'
  return 'Your server could not be submitted. Please try again.'
}
