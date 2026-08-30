import type { ServerSubmission } from '../submission/types'

export type ModerationStatus = 'pending' | 'approved' | 'rejected'

export type ModerationItem = ServerSubmission & {
  id: string
  submittedAt: string
  status: ModerationStatus
}

export type AdminAccessService = {
  canModerate: () => Promise<boolean>
}

export type AdminAuthService = {
  signIn: (email: string, password: string) => Promise<'ready' | 'verify-email'>
  sendVerification: () => Promise<void>
  refreshVerification: () => Promise<boolean>
  signOut: () => Promise<void>
}

export type ModerationService = {
  listPending: () => Promise<ModerationItem[]>
  decide: (id: string, decision: 'approve' | 'reject') => Promise<{ ok: boolean; message: string }>
}

export type DonationClaimReviewItem = {
  id: string
  serverName: string
  gameName: string
  website: string
  donorReference: string
  durationDays: number
  expectedAmountMinor: string
  currency: string
  createdAt: string
}

export type DonationClaimReviewService = {
  listPending: () => Promise<DonationClaimReviewItem[]>
  decide: (input: {
    id: string
    decision: 'verify' | 'reject'
    expectedAmountMinor: string
    currency: string
    reasonCode?: string
  }) => Promise<{ ok: boolean; message: string }>
}
