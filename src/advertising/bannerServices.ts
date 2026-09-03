import { getFirebaseAuth } from '../firebase'
import type { BannerUploadService, ExclusiveServerAd, ExclusiveServersService } from './bannerTypes'

const imageTypes = new Set(['image/gif', 'image/png', 'image/jpeg'])

export const bannerUploadService: BannerUploadService = {
  async upload(input) {
    if (!input.serverId || !input.altText || !imageTypes.has(input.file.type)) return { ok: false, message: 'Check the banner details and choose an approved image.' }
    try {
      const user = getFirebaseAuth()?.currentUser
      if (!user) return { ok: false, message: 'Sign in to upload a banner.' }
      if (!user.emailVerified) return { ok: false, message: 'Verify your email address before uploading a banner.' }
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      if (!apiBaseUrl) return { ok: false, message: 'Banner uploads are temporarily unavailable.' }
      const idToken = await user.getIdToken()
      const response = await uploadProtectedBanner(apiBaseUrl, input, { idToken })
      if (!response.ok) return { ok: false, message: uploadError(response.status) }
      return { ok: true, message: 'Your banner was uploaded for moderation review.' }
    } catch {
      return { ok: false, message: 'Your banner could not be uploaded. Please try again.' }
    }
  },
}

export function uploadProtectedBanner(apiBaseUrl: string, input: { serverId: string; altText: string; file: File }, credentials: { idToken: string }, fetcher: typeof fetch = fetch) {
  const form = new FormData()
  form.set('serverId', input.serverId)
  form.set('altText', input.altText)
  form.set('banner', input.file)
  return fetcher(new URL('/api/advertising/banners', apiBaseUrl), {
    method: 'POST',
    headers: { authorization: `Bearer ${credentials.idToken}` },
    body: form,
  })
}

export const exclusiveServersService: ExclusiveServersService = {
  async list(gameSlug, signal) {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
    if (!apiBaseUrl) throw new Error('Unavailable')
    const response = await fetch(new URL(`/api/games/${encodeURIComponent(gameSlug)}/exclusive-servers`, apiBaseUrl), { signal })
    if (!response.ok) throw new Error('Unavailable')
    const body = await response.json() as { advertisements?: unknown }
    if (!Array.isArray(body.advertisements)) throw new Error('Unavailable')
    return body.advertisements.filter((value): value is ExclusiveServerAd => isExclusiveAd(value, gameSlug)).slice(0, 3)
  },
}

function isExclusiveAd(value: unknown, gameSlug: string): value is ExclusiveServerAd {
  if (!value || typeof value !== 'object') return false
  const ad = value as Record<string, unknown>
  return typeof ad.id === 'string' && typeof ad.serverId === 'string' && ad.gameSlug === gameSlug &&
    typeof ad.serverName === 'string' && ad.serverName.length > 0 && ad.serverName.length <= 80 &&
    isHttps(ad.website) && isHttps(ad.bannerUrl) && isHttps(ad.staticBannerUrl) &&
    typeof ad.altText === 'string' && ad.altText.length >= 5 && ad.altText.length <= 180
}

function isHttps(value: unknown) {
  try { return typeof value === 'string' && new URL(value).protocol === 'https:' } catch { return false }
}

function uploadError(status: number) {
  if (status === 400 || status === 413 || status === 415 || status === 422) return 'Choose a GIF, PNG, or JPEG banner that meets the upload requirements.'
  if (status === 401 || status === 403) return 'Only a verified owner of this approved server can upload its banner.'
  if (status === 429) return 'Banner uploads are temporarily limited. Please wait and try again.'
  return 'Your banner could not be uploaded. Please try again.'
}
