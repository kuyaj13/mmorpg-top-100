const encoder = new TextEncoder()

export async function deriveVoterKey(secret: string, uid: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`vote:v1:${uid}`)))
}
