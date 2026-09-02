import { getFirebaseAuth } from '../firebase'
import type { VoteResult, VotingService } from './types'

type VoteResponse = { votes?: unknown; message?: unknown }

export const votingService: VotingService = {
  async vote(serverId, turnstileToken) {
    if (!serverId || !turnstileToken) return { ok: false, message: 'Complete the security check before voting.' }

    try {
      const user = getFirebaseAuth()?.currentUser
      if (!user) return { ok: false, message: 'Sign in to vote for this server.' }
      if (!user.emailVerified) return { ok: false, message: 'Verify your email address before voting.' }

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      if (!apiBaseUrl) return { ok: false, message: 'Voting is temporarily unavailable.' }
      const idToken = await user.getIdToken()
      const response = await submitProtectedVote(apiBaseUrl, serverId, {
        idToken,
        turnstileToken,
      })
      const body = await response.json().catch(() => null) as VoteResponse | null
      if (!response.ok) return { ok: false, message: publicVoteError(response.status) }
      if (!Number.isSafeInteger(body?.votes) || Number(body?.votes) < 0) {
        return { ok: false, message: 'Your vote could not be confirmed. Please refresh and try again.' }
      }
      return { ok: true, votes: Number(body?.votes) }
    } catch {
      return { ok: false, message: 'Your vote could not be recorded. Please try again.' }
    }
  },
}

export function submitProtectedVote(
  apiBaseUrl: string,
  serverId: string,
  credentials: { idToken: string; turnstileToken: string },
  fetcher: typeof fetch = fetch,
) {
  return fetcher(new URL(`/api/servers/${encodeURIComponent(serverId)}/votes`, apiBaseUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${credentials.idToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ turnstileToken: credentials.turnstileToken }),
  })
}

function publicVoteError(status: number): string {
  if (status === 401) return 'Sign in with a verified account to vote.'
  if (status === 400 || status === 403) return 'Complete the security check again before voting.'
  if (status === 409) return 'You have already voted for this server today.'
  if (status === 404) return 'This server is not available for voting.'
  if (status === 429) return 'Voting is temporarily limited. Please wait and try again.'
  return 'Your vote could not be recorded. Please try again.'
}

export type { VoteResult }
