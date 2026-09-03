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
    const apiBaseUrl=import.meta.env.VITE_API_BASE_URL
    const user=requireAuth().currentUser
    if(!apiBaseUrl||!user||!user.emailVerified) throw new Error('Donation review is unavailable.')
    const response=await requestDonationReview(apiBaseUrl,'/api/admin/donation-claims',await user.getIdToken())
    if(!response.ok) throw new Error('Donation review is unavailable.')
    const body=await response.json() as { donationClaims?:unknown }
    if(!Array.isArray(body.donationClaims)||!body.donationClaims.every(isDonationClaimReviewItem)) throw new Error('Donation review is unavailable.')
    return body.donationClaims
  },
  async decide(input) {
    try {
      const apiBaseUrl=import.meta.env.VITE_API_BASE_URL
      const user=requireAuth().currentUser
      if(!apiBaseUrl||!user||!user.emailVerified) throw new Error('Unavailable')
      const response=await requestDonationReview(apiBaseUrl,`/api/admin/donation-claims/${encodeURIComponent(input.id)}/decision`,await user.getIdToken(true),input.decision,input.reasonCode)
      const body=await response.json().catch(()=>null) as {message?:unknown}|null
      if(!response.ok) return {ok:false,message:typeof body?.message==='string'?body.message:'The donation decision could not be saved. Please try again.'}
      return {ok:true,message:input.decision==='verify'?'The donation claim was verified.':'The donation claim was rejected.'}
    } catch {
      return { ok: false, message: 'The donation decision could not be saved. Please try again.' }
    }
  },
}

export function requestDonationReview(apiBaseUrl:string,path:string,idToken:string,decision?:'verify'|'reject',reasonCode?:string,fetcher:typeof fetch=fetch){
  return fetcher(new URL(path,apiBaseUrl),{method:decision?'POST':'GET',headers:{authorization:`Bearer ${idToken}`,...(decision?{'content-type':'application/json'}:{})},body:decision?JSON.stringify({decision,...(decision==='reject'?{reasonCode:reasonCode??'not_matched'}:{}),operationId:crypto.randomUUID()}):undefined})
}

function isDonationClaimReviewItem(value:unknown):value is Awaited<ReturnType<DonationClaimReviewService['listPending']>>[number]{
  if(!value||typeof value!=='object'||Array.isArray(value)) return false
  const item=value as Record<string,unknown>,keys=new Set(['id','serverName','gameName','website','donorReference','durationDays','expectedAmountMinor','currency','createdAt'])
  if(!Object.keys(item).every((key)=>keys.has(key))||typeof item.id!=='string'||typeof item.serverName!=='string'||typeof item.gameName!=='string'||typeof item.donorReference!=='string'||typeof item.durationDays!=='number'||!Number.isInteger(item.durationDays)||typeof item.expectedAmountMinor!=='string'||typeof item.currency!=='string'||typeof item.createdAt!=='string'||!Number.isFinite(Date.parse(item.createdAt))) return false
  try{return typeof item.website==='string'&&new URL(item.website).protocol==='https:'}catch{return false}
}

function toServerMode(mode: string): ModerationItem['mode'] {
  if (mode === 'PvE' || mode === 'PvP' || mode === 'RPG') return mode
  return 'RPG'
}
