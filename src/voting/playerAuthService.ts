import { createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { getFirebaseAuth } from '../firebase'

export type PlayerAuthStatus = 'signed-out' | 'verify-email' | 'ready'
export type PlayerAuthService = {
  currentStatus(): Promise<PlayerAuthStatus>
  signIn(email: string, password: string): Promise<PlayerAuthStatus>
  register(email: string, password: string): Promise<PlayerAuthStatus>
  sendVerification(): Promise<void>
  refreshVerification(): Promise<boolean>
  signOut(): Promise<void>
}

function requireAuth() { const auth = getFirebaseAuth(); if (!auth) throw new Error('Authentication is unavailable.'); return auth }
async function currentUser() { const auth = requireAuth(); return new Promise<typeof auth.currentUser>((resolve, reject) => { const unsubscribe = onAuthStateChanged(auth, (user) => { unsubscribe(); resolve(user) }, reject) }) }

export const playerAuthService: PlayerAuthService = {
  async currentStatus() { const user = await currentUser(); if (!user) return 'signed-out'; return user.emailVerified ? 'ready' : 'verify-email' },
  async signIn(email, password) { const credential = await signInWithEmailAndPassword(requireAuth(), email, password); return credential.user.emailVerified ? 'ready' : 'verify-email' },
  async register(email, password) { const credential = await createUserWithEmailAndPassword(requireAuth(), email, password); await sendEmailVerification(credential.user); return 'verify-email' },
  async sendVerification() { const user = requireAuth().currentUser; if (!user) throw new Error('Authentication is unavailable.'); await sendEmailVerification(user) },
  async refreshVerification() { const user = requireAuth().currentUser; if (!user) return false; await user.reload(); if (user.emailVerified) await user.getIdToken(true); return user.emailVerified },
  async signOut() { await signOut(requireAuth()) },
}
