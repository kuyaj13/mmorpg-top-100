const encoder = new TextEncoder()
export async function deriveModeratorKey(secret: string, uid: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`moderator\0${uid}`)))
}

