import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { getFirebaseAuth } from '../firebase'
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
    const apiBaseUrl=import.meta.env.VITE_API_BASE_URL
    if(!apiBaseUrl)throw new Error('The advertising API is unavailable.')
    const response=await requestAdvertisingWorkspace(apiBaseUrl,await user.getIdToken())
    const body=await response.json().catch(()=>null) as Record<string,unknown>|null
    if(!response.ok||!isAdvertisingWorkspace(body))throw new Error('The advertising workspace is unavailable.')
    return body
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
      const idToken = await user.getIdToken()
      const response = await submitProtectedClaim(apiBaseUrl, {
        idToken,
      }, {
        serverId: input.serverId,
        packageCode: input.packageCode,
        donorReference,
        turnstileToken: input.turnstileToken,
      })
      const result = await response.json().catch(() => null) as { message?: unknown;claimId?:unknown } | null
      if (!response.ok) return { ok: false,...publicClaimError(response.status, result?.message) }
      if(typeof result?.claimId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.claimId))return{ok:false,message:'Your donation claim was saved, but its confirmation could not be loaded. Refresh the page to view it.'}
      return { ok: true, message: 'Your donation claim was submitted for manual review.',claimId:result.claimId }
    } catch {
      return { ok: false, message: 'This donation claim could not be submitted. Check the details and try again.' }
    }
  },
}

export function requestAdvertisingWorkspace(apiBaseUrl:string,idToken:string,fetcher:typeof fetch=fetch){return fetcher(new URL('/api/advertising/workspace',apiBaseUrl),{headers:{authorization:`Bearer ${idToken}`},cache:'no-store'})}

export function submitProtectedClaim(
  apiBaseUrl: string,
  credentials: { idToken: string },
  input: { serverId: string; packageCode: string; donorReference: string; turnstileToken: string },
  fetcher: typeof fetch = fetch,
) {
  return fetcher(new URL('/api/advertising/claims', apiBaseUrl), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${credentials.idToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(input),
      })
}

export function publicClaimError(status: number, message: unknown) {
  if(status===403)return{message:'Complete the security check again.',fieldErrors:{turnstileToken:'Complete the security check again.'}}
  if(status===409)return{message:'This PayPal transaction reference has already been used.',fieldErrors:{donorReference:'Enter a different PayPal transaction reference.'}}
  if(status===401)return{message:'Your account could not be verified. Sign out, then sign in again.'}
  if(status===400&&message==='This claim is not available for submission.')return{message:'Check the highlighted fields and try again.',fieldErrors:{serverId:'Select an eligible approved server.',packageCode:'Select an available placement duration.'}}
  if(status===429)return{message:'You already have several claims awaiting review.'}
  return {message:'This donation claim could not be submitted. Check the details and try again.'}
}

function normalizeReference(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

function isAdvertisingWorkspace(value:unknown):value is import('./types').AdvertisingWorkspace{if(!value||typeof value!=='object'||Array.isArray(value))return false;const data=value as Record<string,unknown>;return Array.isArray(data.servers)&&data.servers.every(isServer)&&Array.isArray(data.exclusiveServers)&&data.exclusiveServers.every(isServer)&&Array.isArray(data.packages)&&data.packages.every(isPackage)&&Array.isArray(data.claims)&&data.claims.every(isClaim)}
const text=(value:unknown,max:number)=>typeof value==='string'&&value.length>0&&value.length<=max
function isServer(value:unknown){if(!value||typeof value!=='object'||Array.isArray(value))return false;const item=value as Record<string,unknown>;return text(item.id,100)&&text(item.name,80)&&text(item.gameName,80)&&text(item.gameSlug,80)}
function isPackage(value:unknown):value is AdPackageOption{if(!value||typeof value!=='object'||Array.isArray(value))return false;const item=value as Record<string,unknown>;return text(item.code,40)&&(item.durationDays===7||item.durationDays===30)&&text(item.tier,30)&&typeof item.priceMinor==='string'&&/^\d+$/.test(item.priceMinor)&&text(item.currency,3)}
function isClaim(value:unknown){if(!value||typeof value!=='object'||Array.isArray(value))return false;const item=value as Record<string,unknown>;return text(item.id,100)&&text(item.serverName,80)&&text(item.gameName,80)&&typeof item.durationDays==='number'&&['pending','verified','rejected'].includes(String(item.status))&&typeof item.createdAt==='string'&&Number.isFinite(Date.parse(item.createdAt))&&(!('rejectionReason'in item)||item.rejectionReason===undefined||text(item.rejectionReason,80))}
