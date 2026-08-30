import {
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { getFirebaseAuth } from '../firebase'
import {
  adminApproveSubmission,
  adminListPendingSubmissions,
  adminRejectSubmission,
  adminListPendingDonationClaims,
  adminVerifyDonationClaim,
  adminRejectDonationClaim,
} from '../generated/sql-connect'
import type { ModerationItem } from './types'
import type { AdminAccessService, AdminAuthService, DonationClaimReviewService, ModerationService } from './types'

function requireAuth() {
  const auth = getFirebaseAuth()
  if (!auth) throw new Error('Firebase is unavailable.')
  return auth
}

export const adminAuthService: AdminAuthService = {
  async signIn(email, password) {
    const credential = await signInWithEmailAndPassword(requireAuth(), email, password)
    return credential.user.emailVerified ? 'ready' : 'verify-email'
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

export const adminAccessService: AdminAccessService = {
  async canModerate() {
    const auth = getFirebaseAuth()
    if (!auth) return false
    const user = await new Promise<typeof auth.currentUser>((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        unsubscribe()
        resolve(currentUser)
      })
    })
    if (!user || !user.emailVerified) return false
    const token = await user.getIdTokenResult(true)
    const authenticatedAt = Number(token.claims.auth_time)
    const recentlyAuthenticated =
      Number.isFinite(authenticatedAt) && Date.now() / 1000 - authenticatedAt <= 10 * 60
    return token.claims.admin === true && recentlyAuthenticated
  },
}

export const moderationService: ModerationService = {
  async listPending() {
    const result = await adminListPendingSubmissions({ fetchPolicy: 'SERVER_ONLY' })
    return result.data.serverSubmissions.map(
      (submission): ModerationItem => ({
        id: submission.id,
        name: submission.name,
        website: submission.website,
        gameVersion: submission.gameVersion,
        region: submission.region,
        mode: toServerMode(submission.mode),
        description: submission.description,
        submittedAt: submission.submittedAt,
        status: 'pending',
      }),
    )
  },
  async decide(id, decision) {
    try {
      if (decision === 'approve') await adminApproveSubmission({ id })
      else await adminRejectSubmission({ id })
      return {
        ok: true,
        message: decision === 'approve' ? 'The listing was approved.' : 'The listing was rejected.',
      }
    } catch {
      return { ok: false, message: 'This submission is no longer pending review.' }
    }
  },
}

export const donationClaimReviewService: DonationClaimReviewService = {
  async listPending() {
    const result = await adminListPendingDonationClaims({ fetchPolicy: 'SERVER_ONLY' })
    return result.data.donationClaims.map((claim) => ({
      id: claim.id,
      serverName: claim.server.name,
      gameName: claim.server.game.name,
      website: claim.server.website,
      donorReference: claim.donorReference,
      durationDays: claim.package.durationDays,
      expectedAmountMinor: claim.package.priceMinor,
      currency: claim.package.currency,
      createdAt: claim.createdAt,
    }))
  },
  async decide(input) {
    try {
      if (input.decision === 'verify') {
        await adminVerifyDonationClaim({
          id: input.id,
          verifiedAmountMinor: input.expectedAmountMinor,
          verifiedCurrency: input.currency,
        })
        return { ok: true, message: 'The donation claim was verified.' }
      }
      await adminRejectDonationClaim({ id: input.id, reasonCode: input.reasonCode ?? 'not_matched' })
      return { ok: true, message: 'The donation claim was rejected.' }
    } catch {
      return { ok: false, message: 'This donation claim is no longer pending review.' }
    }
  },
}

function toServerMode(mode: string): ModerationItem['mode'] {
  if (mode === 'PvE' || mode === 'PvP' || mode === 'RPG') return mode
  return 'RPG'
}
