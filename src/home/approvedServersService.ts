export type ApprovedServer = {
  id: string
  name: string
  website: string
  votes: number
  game: { slug: string; name: string }
}

export type ApprovedServersService = { list: (signal?: AbortSignal) => Promise<ApprovedServer[]> }

function isApprovedServer(value: unknown): value is ApprovedServer {
  if (!value || typeof value !== 'object') return false
  const server = value as Record<string, unknown>
  const game = server.game
  let website: URL
  try { website = new URL(String(server.website)) } catch { return false }
  return typeof server.id === 'string' && typeof server.name === 'string' &&
    website.protocol === 'https:' && !website.username && !website.password &&
    typeof server.votes === 'number' && Number.isSafeInteger(server.votes) && server.votes >= 0 &&
    Boolean(game) && typeof game === 'object' &&
    typeof (game as Record<string, unknown>).slug === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test((game as Record<string, unknown>).slug as string) &&
    typeof (game as Record<string, unknown>).name === 'string'
}

export function createApprovedServersService(fetcher: typeof fetch = fetch): ApprovedServersService {
  return { async list(signal) {
    const response = await fetcher('https://api.mmorpgtop100.com/api/servers', { headers: { accept: 'application/json' }, signal })
    if (!response.ok) throw new Error('Approved servers request failed')
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || (payload as Record<string, unknown>).ok !== true ||
      !Array.isArray((payload as Record<string, unknown>).servers) ||
      ((payload as Record<string, unknown>).servers as unknown[]).length > 100 ||
      !((payload as Record<string, unknown>).servers as unknown[]).every(isApprovedServer)) {
      throw new Error('Invalid approved servers response')
    }
    return (payload as { servers: ApprovedServer[] }).servers
  } }
}

export const approvedServersService = createApprovedServersService()
