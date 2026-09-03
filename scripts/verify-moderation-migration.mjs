import pg from 'pg'

const owner = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED })
const runtime = new pg.Client({ connectionString: process.env.DATABASE_URL_RESTRICTED })
if (!process.env.DATABASE_URL_UNPOOLED || !process.env.DATABASE_URL_RESTRICTED) throw new Error('Both direct test connections are required.')
try {
  await owner.connect(); await runtime.connect()
  let privateReadDenied = false
  try { await runtime.query('SELECT id FROM app.server_moderation_events LIMIT 1') } catch { privateReadDenied = true }
  if (!privateReadDenied) throw new Error('Runtime can read private audit data.')
  let pending = await runtime.query('SELECT * FROM api.list_pending_server_submissions()')
  if (!pending.rows[0]) {
    await owner.query('SELECT * FROM api.submit_server($1,$2,$3,$4,$5,$6,$7,$8,$9)', [Buffer.alloc(32, 40), 'flyff', 'Moderation Verification', 'https://moderation-verification.invalid/', 'moderation-verification.invalid', 'v1', 'Global', 'PvE', 'Temporary expiring-branch verification listing.'])
    pending = await runtime.query('SELECT * FROM api.list_pending_server_submissions()')
  }
  const candidate = pending.rows[0]
  if (!candidate) throw new Error('The verification submission could not be created.')
  await runtime.query('BEGIN')
  const operationId = '123e4567-e89b-42d3-a456-426614174099'
  const key = Buffer.alloc(32, 41)
  const first = await runtime.query('SELECT * FROM api.moderate_server_submission($1,$2,$3,$4,$5)', [candidate.id, key, 'approve', null, operationId])
  const replay = await runtime.query('SELECT * FROM api.moderate_server_submission($1,$2,$3,$4,$5)', [candidate.id, key, 'approve', null, operationId])
  if (first.rows[0]?.outcome !== 'approved' || replay.rows[0]?.server_id !== first.rows[0]?.server_id) throw new Error('Atomic idempotent approval failed.')
  await runtime.query('ROLLBACK')
  console.log('Moderation migration verification passed; decision writes were rolled back.')
} finally { await Promise.allSettled([owner.end(), runtime.end()]) }
