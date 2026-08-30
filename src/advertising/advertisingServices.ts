import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { getFirebaseAppCheckToken, getFirebaseAuth } from '../firebase'
import {
  advertiserListActivePackages,
  advertiserListMyClaims,
  advertiserListMyEligibleServers,
} from '../generated/advertiser'
import type { AdvertiserAuthService, AdvertisingService, AdPackageOption } from './types'

function requireAuth() {
  const auth = getFirebaseAuth()
  if (!auth) throw new Error('Firebase is unavailable.')
  return auth
}

async function currentUser() {
  const auth = requireAuth()
  return new Promise<NonNullable<typeof auth.currentUser>>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      if (user) resolve(user)
      else reject(new Error('Sign in is required.'))
    }, reject)
  })
}

export const advertiserAuthService: AdvertiserAuthService = {
  async currentStatus() {
    try {
      const user = await currentUser()
      return user.emailVerified ? 'ready' : 'verify-email'
    } catch {
      return 'signed-out'
    }
  },
  async signIn(email, password) {
    const credential = await signInWithEmailAndPassword(requireAuth(), email, password)
    return credential.user.emailVerified ? 'ready' : 'verify-email'
  },
  async register(email, password) {
    const credential = await createUserWithEmailAndPassword(requireAuth(), email, password)
    await sendEmailVerification(credential.user)
    return 'verify-email'
  },
  async sendVerification() {
    const user = requireAuth().currentUser
    if (!user) throw new Error('Sign in is required.')
    await sendEmailVerification(user)
  },
  async refreshVerification() {
    const user = requireAuth().currentUser
    if (!user) return false
    await user.reload()
    if (user.emailVerified) await user.getIdToken(true)
    return user.emailVerified
  },
  async signOut() {
    await signOut(requireAuth())
  },
}

export const advertisingService: AdvertisingService = {
  async loadWorkspace() {
    const user = await currentUser()
    if (!user.emailVerified) throw new Error('Email verification is required.')
    const [serverResult, packageResult, claimResult] = await Promise.all([
      advertiserListMyEligibleServers({ ownerUid: user.uid }, { fetchPolicy: 'SERVER_ONLY' }),
      advertiserListActivePackages({ fetchPolicy: 'SERVER_ONLY' }),
      advertiserListMyClaims({ advertiserUid: user.uid }, { fetchPolicy: 'SERVER_ONLY' }),
    ])
    return {
      servers: serverResult.data.servers.map((server) => ({
        id: server.id,
        name: server.name,
        gameName: server.game.name,
        gameSlug: server.game.slug,
      })),
      packages: packageResult.data.adPackages
        .filter((item): item is typeof item & { durationDays: 7 | 30 } => item.durationDays === 7 || item.durationDays === 30)
        .map((item): AdPackageOption => ({ code: item.code, durationDays: item.durationDays, tier: item.tier, priceMinor: item.priceMinor, currency: item.currency })),
      claims: claimResult.data.donationClaims.map((claim) => ({
        id: claim.id,
        serverName: claim.server.name,
        gameName: claim.server.game.name,
        durationDays: claim.package.durationDays,
        status: toClaimStatus(claim.status),
        createdAt: claim.createdAt,
        rejectionReason: claim.rejectionReasonCode ?? undefined,
      })),
    }
  },
  async createClaim(input) {
    const user = await currentUser()
    if (!user.emailVerified) return { ok: false, message: 'Verify your email address before continuing.' }
    const donorReference = normalizeReference(input.donorReference)
    if (!/^[A-Z0-9]{8,128}$/.test(donorReference)) {
      return { ok: false, message: 'Enter a valid PayPal transaction reference.' }
    }
    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
      if (!apiBaseUrl) throw new Error('The advertising API is unavailable.')
      const [idToken, appCheckToken] = await Promise.all([
        user.getIdToken(),
        getFirebaseAppCheckToken(),
      ])
      const response = await submitProtectedClaim(apiBaseUrl, {
        idToken,
        appCheckToken,
      }, {
        serverId: input.serverId,
        packageCode: input.packageCode,
        donorReference,
        turnstileToken: input.turnstileToken,
      })
      const result = await response.json().catch(() => null) as { message?: unknown } | null
      if (!response.ok) return { ok: false, message: publicClaimError(response.status, result?.message) }
      return { ok: true, message: 'Your donation claim was submitted for manual review.' }
    } catch {
      return { ok: false, message: 'This donation claim could not be submitted. Check the details and try again.' }
    }
  },
}

export function submitProtectedClaim(
  apiBaseUrl: string,
  credentials: { idToken: string; appCheckToken: string },
  input: { serverId: string; packageCode: string; donorReference: string; turnstileToken: string },
  fetcher: typeof fetch = fetch,
) {
  return fetcher(new URL('/api/advertising/claims', apiBaseUrl), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${credentials.idToken}`,
          'content-type': 'application/json',
          'x-firebase-appcheck': credentials.appCheckToken,
        },
        body: JSON.stringify(input),
      })
}

function publicClaimError(status: number, message: unknown) {
  if (typeof message === 'string' && status >= 400 && status < 500) return message
  return 'This donation claim could not be submitted. Check the details and try again.'
}

function normalizeReference(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

function toClaimStatus(value: string): DonationClaimSummary['status'] {
  if (value === 'verified' || value === 'rejected') return value
  return 'pending'
}

import type { DonationClaimSummary } from './types'
