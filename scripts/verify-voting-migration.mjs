import pg from 'pg'

const { Client } = pg
const ownerUrl = process.env.DATABASE_URL_UNPOOLED
const restrictedUrl = process.env.DATABASE_URL_RESTRICTED

if (!ownerUrl || !restrictedUrl) throw new Error('Both test-branch database connections are required.')
if (ownerUrl.includes('-pooler') || restrictedUrl.includes('-pooler')) throw new Error('Verification requires direct connections.')

const owner = new Client({ connectionString: ownerUrl })
const restricted = new Client({ connectionString: restrictedUrl })
const voterKey = Buffer.alloc(32, 7)

try {
  await owner.connect()
  await restricted.connect()

  const serverResult = await owner.query("SELECT id, vote_count FROM app.servers WHERE name = 'Prologic Flyff' LIMIT 1")
  const server = serverResult.rows[0]
  if (!server) throw new Error('The verification server is unavailable.')

  await restricted.query('BEGIN')
  const first = await restricted.query('SELECT recorded, votes::text FROM api.cast_daily_vote($1, $2)', [server.id, voterKey])
  const second = await restricted.query('SELECT recorded, votes::text FROM api.cast_daily_vote($1, $2)', [server.id, voterKey])
  if (first.rows[0]?.recorded !== true || second.rows[0]?.recorded !== false) throw new Error('Daily duplicate prevention failed.')
  if (first.rows[0]?.votes !== (BigInt(server.vote_count) + 1n).toString() || second.rows[0]?.votes !== first.rows[0]?.votes) {
    throw new Error('Atomic vote totals failed.')
  }
  await restricted.query('ROLLBACK')

  await owner.query('BEGIN')
  await owner.query('UPDATE app.servers SET status = $1 WHERE id = $2', ['inactive', server.id])
  const inactive = await owner.query('SELECT * FROM api.cast_daily_vote($1, $2)', [server.id, Buffer.alloc(32, 8)])
  if (inactive.rowCount !== 0) throw new Error('Inactive server voting was not rejected.')
  await owner.query('ROLLBACK')

  await owner.query('BEGIN')
  const inserted = await owner.query(
    "INSERT INTO app.votes (server_id, voter_key, voting_day) VALUES ($1, $2, (clock_timestamp() AT TIME ZONE 'UTC')::date) RETURNING id",
    [server.id, Buffer.alloc(32, 9)],
  )
  let mutationRejected = false
  try {
    await owner.query('UPDATE app.votes SET created_at = created_at WHERE id = $1', [inserted.rows[0].id])
  } catch {
    mutationRejected = true
  }
  await owner.query('ROLLBACK')
  if (!mutationRejected) throw new Error('Append-only enforcement failed.')

  const finalCount = await owner.query('SELECT vote_count::text FROM app.servers WHERE id = $1', [server.id])
  if (finalCount.rows[0]?.vote_count !== String(server.vote_count)) throw new Error('Verification changed persistent vote totals.')
  console.log('Voting migration verification passed without persistent data changes.')
} finally {
  await Promise.allSettled([owner.end(), restricted.end()])
}
