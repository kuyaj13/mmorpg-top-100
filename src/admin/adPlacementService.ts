import { getFirebaseAuth } from '../firebase'
import type { AdPlacementItem, AdPlacementService } from './types'

const statuses = new Set(['active', 'waiting', 'suspended', 'expired'])
const safeDecisionMessages = new Set([
  'The advertisement was suspended.',
  'The advertisement was reactivated.',
  'This game currently has no available advertising position.',
  'This advertisement is not eligible to run.',
  'This advertisement has expired.',
  'This advertisement is no longer available.',
])

function currentAdmin() {
  const user = getFirebaseAuth()?.currentUser
  if (!user || !user.emailVerified) throw new Error('Administrator access is required.')
  return user
}

export const adPlacementService: AdPlacementService = {
  async list() {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      if (!apiBaseUrl) throw new Error('Unavailable')
      const response = await requestAdPlacement(apiBaseUrl, '/api/admin/ad-placements', await currentAdmin().getIdToken())
      if (!response.ok) throw new Error('Unavailable')
      return parseAdPlacements(await response.json())
    } catch {
      throw new Error('Advertisement records are unavailable.')
    }
  },
  async decide(id, decision) {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      if (!apiBaseUrl) throw new Error('Unavailable')
      const response = await requestAdPlacement(
        apiBaseUrl,
        `/api/admin/ad-placements/${encodeURIComponent(id)}/decision`,
        await currentAdmin().getIdToken(true),
        decision,
      )
      return readDecisionResult(response)
    } catch {
      return { ok: false, message: 'The advertisement decision could not be saved.' }
    }
  },
}

export async function readDecisionResult(response: Response) {
  const body = await response.json().catch(() => null) as { message?: unknown } | null
  const message = typeof body?.message === 'string' && safeDecisionMessages.has(body.message)
    ? body.message
    : 'The advertisement decision could not be saved.'
  return { ok: response.ok, message }
}

export function requestAdPlacement(
  apiBaseUrl: string,
  path: string,
  idToken: string,
  decision?: 'suspend' | 'reactivate',
  fetcher: typeof fetch = fetch,
) {
  return fetcher(new URL(path, apiBaseUrl), {
    method: decision ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${idToken}`, ...(decision ? { 'content-type': 'application/json' } : {}) },
    body: decision ? JSON.stringify({ decision, operationId: crypto.randomUUID() }) : undefined,
  })
}

export function parseAdPlacements(value: unknown): AdPlacementItem[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unavailable')
  const placements = (value as { placements?: unknown }).placements
  if (!Array.isArray(placements) || !placements.every(isAdPlacement)) throw new Error('Unavailable')
  return placements
}

function isAdPlacement(value: unknown): value is AdPlacementItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  const keys = new Set(['id', 'serverName', 'website', 'gameSlug', 'gameName', 'durationDays', 'status', 'startsAt', 'expiresAt', 'queuedAt', 'bannerStatus', 'claimStatus', 'impressionCount'])
  return Object.keys(item).every((key) => keys.has(key)) &&
    boundedText(item.id, 100) && boundedText(item.serverName, 80) && safeHttpsUrl(item.website) &&
    boundedText(item.gameSlug, 80) && boundedText(item.gameName, 80) &&
    (item.durationDays === 7 || item.durationDays === 30) && statuses.has(String(item.status)) &&
    nullableDate(item.startsAt) && nullableDate(item.expiresAt) && validDate(item.queuedAt) &&
    boundedText(item.bannerStatus, 30) && boundedText(item.claimStatus, 30) && Number.isSafeInteger(item.impressionCount) && Number(item.impressionCount)>=0
}

function boundedText(value: unknown, maximum: number) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum
}

function validDate(value: unknown) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function nullableDate(value: unknown) {
  return value === null || validDate(value)
}

function safeHttpsUrl(value: unknown) {
  try { return typeof value === 'string' && new URL(value).protocol === 'https:' } catch { return false }
}
