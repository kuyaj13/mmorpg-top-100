import { getFirebaseAuth } from '../firebase'
import type { BannerReviewItem, BannerReviewService } from './types'

type PendingResponse = { banners?: unknown }

function currentAdmin() {
  const user = getFirebaseAuth()?.currentUser
  if (!user || !user.emailVerified) throw new Error('Administrator access is required.')
  return user
}

export const bannerReviewApiService: BannerReviewService = {
  async listPending() {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      if (!apiBaseUrl) throw new Error('Unavailable')
      const idToken = await currentAdmin().getIdToken()
      const response = await requestBannerReview(apiBaseUrl, '/api/admin/banners', idToken)
      if (!response.ok) throw new Error('Unavailable')
      const body = await response.json() as PendingResponse
      if (!Array.isArray(body.banners) || !body.banners.every(isPendingBanner)) throw new Error('Unavailable')
      return body.banners
    } catch {
      throw new Error('Pending banners are unavailable.')
    }
  },
  async loadPreview(id) {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      if (!apiBaseUrl) throw new Error('Unavailable')
      const response = await requestBannerReview(apiBaseUrl, `/api/admin/banners/${encodeURIComponent(id)}/preview`, await currentAdmin().getIdToken())
      if (!response.ok || response.headers.get('content-type') !== 'image/png') throw new Error('Unavailable')
      const blob = await response.blob()
      if (blob.size < 1 || blob.size > 524_288) throw new Error('Unavailable')
      return blob
    } catch {
      throw new Error('The banner preview is unavailable.')
    }
  },
  async decide(id, decision) {
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      if (!apiBaseUrl) throw new Error('Unavailable')
      const response = await requestBannerReview(apiBaseUrl, `/api/admin/banners/${encodeURIComponent(id)}/decision`, await currentAdmin().getIdToken(true), decision)
      if (response.status === 404 || response.status === 409) return { ok: false, message: 'This banner is no longer pending review.' }
      if (!response.ok) return { ok: false, message: 'The banner decision could not be saved. Please try again.' }
      return { ok: true, message: decision === 'approve' ? 'The banner was approved.' : 'The banner was rejected.' }
    } catch {
      return { ok: false, message: 'The banner decision could not be saved. Please try again.' }
    }
  },
}

export function requestBannerReview(apiBaseUrl: string, path: string, idToken: string, decision?: 'approve' | 'reject', fetcher: typeof fetch = fetch) {
  return fetcher(new URL(path, apiBaseUrl), {
    method: decision ? 'POST' : 'GET',
    headers: { authorization: `Bearer ${idToken}`, ...(decision ? { 'content-type': 'application/json' } : {}) },
    body: decision ? JSON.stringify({ decision, operationId: crypto.randomUUID() }) : undefined,
  })
}

function isPendingBanner(value: unknown): value is BannerReviewItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  const allowedKeys = new Set(['id', 'serverId', 'serverName', 'gameSlug', 'mediaType', 'byteSize', 'frameCount', 'animationDurationMs', 'altText', 'createdAt'])
  return Object.keys(item).every((key) => allowedKeys.has(key)) &&
    isBoundedText(item.id, 100) && isBoundedText(item.serverId, 100) && isBoundedText(item.serverName, 80) &&
    isBoundedText(item.gameSlug, 80) && (item.mediaType === 'image/gif' || item.mediaType === 'image/png' || item.mediaType === 'image/jpeg') &&
    isIntegerBetween(item.byteSize, 1, 524_288) && isIntegerBetween(item.frameCount, 1, 30) &&
    isIntegerBetween(item.animationDurationMs, 0, 15_000) && isBoundedText(item.altText, 160, 10) &&
    typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt))
}

function isBoundedText(value: unknown, maximum: number, minimum = 1) {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum
}

function isIntegerBetween(value: unknown, minimum: number, maximum: number) {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
}
