import { getApp, getApps, initializeApp } from 'firebase/app'
import { getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export function getFirebaseAuth() {
  if (Object.values(config).some((value) => !value)) return null
  const app = getApps().length > 0 ? getApp() : initializeApp(config)
  return getAuth(app)
}

let appCheck: AppCheck | null | undefined

export function getFirebaseAppCheck() {
  if (appCheck !== undefined) return appCheck
  const siteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY
  if (Object.values(config).some((value) => !value) || !siteKey) return (appCheck = null)
  const app = getApps().length > 0 ? getApp() : initializeApp(config)
  return (appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  }))
}

export async function getFirebaseAppCheckToken() {
  const instance = getFirebaseAppCheck()
  if (!instance) throw new Error('App verification is unavailable.')
  return (await getToken(instance)).token
}
