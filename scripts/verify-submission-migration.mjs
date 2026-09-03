import pg from 'pg'

const { Client } = pg
const ownerUrl = process.env.DATABASE_URL_UNPOOLED
const restrictedUrl = process.env.DATABASE_URL_RESTRICTED
if (!ownerUrl || !restrictedUrl) throw new Error('Both test-branch database connections are required.')
if (ownerUrl.includes('-pooler') || restrictedUrl.includes('-pooler')) throw new Error('Verification requires direct connections.')

const owner = new Client({ connectionString: ownerUrl })
const restricted = new Client({ connectionString: restrictedUrl })
const submit = (client, key, name, host) => client.query(
  'SELECT outcome, submission_id FROM api.submit_server($1,$2,$3,$4,$5,$6,$7,$8,$9)',
  [key, 'flyff', name, `https://${host}/`, host, 'v22', 'Global', 'PvE', 'A test submission that is rolled back.'],
)

try {
  await owner.connect()
  await restricted.connect()

  let directReadDenied = false
  try { await restricted.query('SELECT id FROM app.server_submissions LIMIT 1') } catch { directReadDenied = true }
  if (!directReadDenied) throw new Error('The runtime role can read private submissions directly.')

  await restricted.query('BEGIN')
  const ownerKey = Buffer.alloc(32, 31)
  const accepted = await submit(restricted, ownerKey, 'Phase Six Verification', 'phase-six.invalid')
  const duplicate = await submit(restricted, ownerKey, 'Different Name', 'phase-six.invalid')
  if (accepted.rows[0]?.outcome !== 'accepted' || duplicate.rows[0]?.outcome !== 'duplicate') throw new Error('Submission duplicate protection failed.')
  await submit(restricted, ownerKey, 'Phase Six Two', 'phase-six-two.invalid')
  await submit(restricted, ownerKey, 'Phase Six Three', 'phase-six-three.invalid')
  const limited = await submit(restricted, ownerKey, 'Phase Six Four', 'phase-six-four.invalid')
  if (limited.rows[0]?.outcome !== 'limit_reached') throw new Error('Pending owner limit failed.')
  const unavailable = await restricted.query(
    'SELECT outcome FROM api.submit_server($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [Buffer.alloc(32, 32), 'unknown-game', 'Unknown', 'https://unknown.invalid/', 'unknown.invalid', 'v1', 'Global', 'PvE', 'A test submission that is rolled back.'],
  )
  if (unavailable.rows[0]?.outcome !== 'game_unavailable') throw new Error('Inactive game protection failed.')
  await restricted.query('ROLLBACK')

  const persistent = await owner.query("SELECT count(*)::int AS count FROM app.server_submissions WHERE website_host LIKE 'phase-six%.invalid'")
  if (persistent.rows[0]?.count !== 0) throw new Error('Verification left persistent test data.')
  console.log('Submission migration verification passed without persistent data changes.')
} finally {
  await Promise.allSettled([owner.end(), restricted.end()])
}
