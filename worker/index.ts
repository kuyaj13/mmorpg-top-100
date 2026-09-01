type WorkerEnv = Env

export default {
  async fetch(request, env): Promise<Response> {
    try {
      const url = new URL(request.url)
      if (request.method === 'OPTIONS') return corsResponse(request, env, new Response(null, { status: 204 }))
      if (url.pathname === '/api/health' && request.method === 'GET') return corsResponse(request, env, Response.json({ ok: true, plan: 'free' }))
      if (url.pathname === '/api/advertising/claims' && request.method === 'POST') return corsResponse(request, env, jsonError('Donation claims are not available yet.', 503))
      return corsResponse(request, env, jsonError('Not found.', 404))
    } catch (error) {
      if (error instanceof HttpError) return corsResponse(request, env, jsonError(error.message, error.status))
      console.error(JSON.stringify({ event: 'request_failed', error: error instanceof Error ? error.name : 'unknown' }))
      return corsResponse(request, env, jsonError('The request could not be completed.', 500))
    }
  },
} satisfies ExportedHandler<WorkerEnv>

function noStoreHeaders() { return { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } }
function jsonError(message: string, status: number) { return Response.json({ ok: false, message }, { status, headers: noStoreHeaders() }) }
function corsResponse(request: Request, env: WorkerEnv, response: Response) { const origin = request.headers.get('origin'); if (origin === env.ALLOWED_ORIGIN) { response.headers.set('access-control-allow-origin', origin); response.headers.set('access-control-allow-headers', 'authorization, content-type, x-firebase-appcheck'); response.headers.set('access-control-allow-methods', 'GET, POST, OPTIONS'); response.headers.set('vary', 'Origin') } return response }

class HttpError extends Error { constructor(readonly status: number, message: string) { super(message) } }
