import { parseGameSlug } from './contracts/rankings'
import { createHyperdriveRankingRepository, type RankingRepository } from './db/rankingRepository'

type WorkerEnv = Env
type RepositoryFactory = (env: WorkerEnv) => RankingRepository

export function createWorker(repositoryFactory: RepositoryFactory) {
  return {
    async fetch(request, env): Promise<Response> {
      try {
        const url = new URL(request.url)
        if (request.method === 'OPTIONS') return corsResponse(request, env, new Response(null, { status: 204 }))
        if (url.pathname === '/api/health' && request.method === 'GET') return corsResponse(request, env, Response.json({ ok: true }, { headers: noStoreHeaders() }))
        const rankingMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/rankings$/)
        if (rankingMatch) {
          if (request.method !== 'GET') return corsResponse(request, env, methodNotAllowed())
          const gameSlug = parseGameSlug(safeDecode(rankingMatch[1]))
          if (!gameSlug) return corsResponse(request, env, jsonError('Please choose a valid game.', 400))
          const rankings = await repositoryFactory(env).findByGameSlug(gameSlug)
          if (!rankings) return corsResponse(request, env, jsonError('This game is not available.', 404))
          return corsResponse(request, env, Response.json({ ok: true, ...rankings }, { headers: noStoreHeaders() }))
        }
        if (url.pathname === '/api/advertising/claims' && request.method === 'POST') return corsResponse(request, env, jsonError('Donation claims are not available yet.', 503))
        return corsResponse(request, env, jsonError('Not found.', 404))
      } catch (error) {
        console.error(JSON.stringify({ event: 'request_failed', error: error instanceof Error ? error.name : 'unknown' }))
        return corsResponse(request, env, jsonError('The request could not be completed.', 500))
      }
    },
  } satisfies ExportedHandler<WorkerEnv>
}

export default createWorker((env) => createHyperdriveRankingRepository(env.HYPERDRIVE.connectionString))

function noStoreHeaders() { return { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } }
function jsonError(message: string, status: number) { return Response.json({ ok: false, message }, { status, headers: noStoreHeaders() }) }
function methodNotAllowed() { return Response.json({ ok: false, message: 'Method not allowed.' }, { status: 405, headers: { ...noStoreHeaders(), allow: 'GET' } }) }
function corsResponse(request: Request, env: WorkerEnv, response: Response) { const origin = request.headers.get('origin'); if (origin === env.ALLOWED_ORIGIN) { response.headers.set('access-control-allow-origin', origin); response.headers.set('access-control-allow-headers', 'authorization, content-type, x-firebase-appcheck'); response.headers.set('access-control-allow-methods', 'GET, POST, OPTIONS'); response.headers.set('vary', 'Origin') } return response }
function safeDecode(value: string) { try { return decodeURIComponent(value) } catch { return '' } }
