import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'

const keys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))
export type VerifiedAdministrator = { uid: string }

function valid(payload: JWTPayload): payload is JWTPayload & { sub: string } {
  const now = Math.floor(Date.now() / 1000) + 60
  return typeof payload.sub === 'string' && payload.sub.length > 0 && payload.sub.length <= 128 &&
    payload.email_verified === true && payload.admin === true && typeof payload.iat === 'number' && payload.iat <= now &&
    typeof payload.auth_time === 'number' && payload.auth_time <= now && now - payload.auth_time <= 11 * 60
}

export function createAdminVerifier(projectId: string) {
  return async (request: Request): Promise<VerifiedAdministrator | null> => {
    const token = request.headers.get('authorization')?.match(/^Bearer ([^\s]+)$/)?.[1]
    if (!token) return null
    try {
      const { payload, protectedHeader } = await jwtVerify(token, keys, {
        issuer: `https://securetoken.google.com/${projectId}`, audience: projectId, algorithms: ['RS256'],
      })
      return protectedHeader.typ === 'JWT' && valid(payload) ? { uid: payload.sub } : null
    } catch { return null }
  }
}

