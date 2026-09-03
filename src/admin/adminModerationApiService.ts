import { getFirebaseAuth } from '../firebase'
import type { ModerationItem, ModerationService } from './types'

type PendingResponse = { submissions?: unknown }

function currentAdmin() {
  const user = getFirebaseAuth()?.currentUser
  if (!user || !user.emailVerified) throw new Error('Administrator access is required.')
  return user
}

export const adminModerationApiService: ModerationService = {
  async listPending() {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      if (!apiBaseUrl) throw new Error('Unavailable')
      const response = await requestAdminModeration(apiBaseUrl, '/api/admin/server-submissions', await currentAdmin().getIdToken())
      if (!response.ok) throw new Error('Unavailable')
      const body = await response.json() as PendingResponse
      if (!Array.isArray(body.submissions) || !body.submissions.every(isModerationItem)) throw new Error('Unavailable')
      return body.submissions
    } catch {
      throw new Error('Pending submissions are unavailable.')
    }
  },
  async decide(id, decision) {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      if (!apiBaseUrl) throw new Error('Unavailable')
      const response = await requestAdminModeration(apiBaseUrl, `/api/admin/server-submissions/${encodeURIComponent(id)}/decision`, await currentAdmin().getIdToken(true), decision)
      if (response.status === 404 || response.status === 409) return { ok: false, message: 'This submission is no longer pending review.' }
      if (!response.ok) return { ok: false, message: 'The moderation decision could not be saved. Please try again.' }
      return { ok: true, message: decision === 'approve' ? 'The listing was approved.' : 'The listing was rejected.' }
    } catch {
      return { ok: false, message: 'The moderation decision could not be saved. Please try again.' }
    }
  },
}

export function requestAdminModeration(apiBaseUrl: string, path: string, idToken: string, decision?: 'approve' | 'reject', fetcher: typeof fetch = fetch) {
  return fetcher(new URL(path, apiBaseUrl), {
    method: decision ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${idToken}`, ...(decision ? { 'content-type': 'application/json' } : {}) },
    body: decision ? JSON.stringify({ decision, ...(decision === 'reject' ? { reasonCode: 'other' } : {}), operationId: crypto.randomUUID() }) : undefined,
  })
}

function isModerationItem(value: unknown): value is ModerationItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  let safeWebsite = false
  try { safeWebsite = new URL(String(item.website)).protocol === 'https:' } catch { safeWebsite = false }
  return typeof item.id === 'string' && item.id.length > 0 && item.id.length <= 100 &&
    typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 80 && safeWebsite &&
    typeof item.gameVersion === 'string' && typeof item.region === 'string' &&
    (item.mode === 'PvE' || item.mode === 'PvP' || item.mode === 'RPG') && typeof item.description === 'string' &&
    typeof item.submittedAt === 'string' && Number.isFinite(Date.parse(item.submittedAt)) && item.status === 'pending'
}
