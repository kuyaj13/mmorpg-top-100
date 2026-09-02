import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

export type VerifiedFirebaseUser = { uid: string }

type FirebaseVerifierConfig = {
  projectId: string
  projectNumber: string
  appId: string
}

const firebaseAuthKeys = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
)
const appCheckKeys = createRemoteJWKSet(
  new URL('https://firebaseappcheck.googleapis.com/v1/jwks'),
)

function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer ([^\s]+)$/)
  return match?.[1] ?? null
}

function validSubject(payload: JWTPayload): payload is JWTPayload & { sub: string } {
  return typeof payload.sub === 'string' && payload.sub.length > 0 && payload.sub.length <= 128
}

function validIssuedTimes(payload: JWTPayload): boolean {
  const now = Math.floor(Date.now() / 1000) + 60
  return typeof payload.iat === 'number' && payload.iat <= now &&
    (payload.auth_time === undefined || (typeof payload.auth_time === 'number' && payload.auth_time <= now))
}

export function createFirebaseVerifier(config: FirebaseVerifierConfig) {
  const authIssuer = `https://securetoken.google.com/${config.projectId}`
  const appCheckIssuer = `https://firebaseappcheck.googleapis.com/${config.projectNumber}`

  return {
    async verify(request: Request): Promise<VerifiedFirebaseUser | null> {
      try {
        const idToken = bearerToken(request.headers.get('authorization'))
        const appCheckToken = request.headers.get('x-firebase-appcheck')
        if (!idToken || !appCheckToken) return null

        const [{ payload: auth, protectedHeader: authHeader }, { payload: appCheck, protectedHeader: appCheckHeader }] = await Promise.all([
          jwtVerify(idToken, firebaseAuthKeys, { issuer: authIssuer, audience: config.projectId, algorithms: ['RS256'] }),
          jwtVerify(appCheckToken, appCheckKeys, {
            issuer: appCheckIssuer,
            audience: `projects/${config.projectNumber}`,
            algorithms: ['RS256'],
          }),
        ])
        if (authHeader.typ !== 'JWT' || appCheckHeader.typ !== 'JWT') return null
        if (!validSubject(auth) || !validIssuedTimes(auth) || auth.email_verified !== true) return null
        if (!validSubject(appCheck) || !validIssuedTimes(appCheck) || appCheck.sub !== config.appId) return null
        return { uid: auth.sub }
      } catch {
        return null
      }
    },
  }
}
