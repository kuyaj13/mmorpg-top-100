import pg from 'pg'

const { Client } = pg
const connectionString = process.env.DATABASE_URL_UNPOOLED
const expectedHost = process.env.EXPECTED_DATABASE_HOST
const expectedDatabase = process.env.EXPECTED_DATABASE_NAME
const gameSlug = process.argv[2]

if (!connectionString || !expectedHost || !expectedDatabase || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(gameSlug ?? '')) {
  throw new Error('The ranking verification target is incomplete.')
}
const databaseUrl = new URL(connectionString)
if (databaseUrl.hostname.includes('-pooler') || databaseUrl.hostname !== expectedHost || databaseUrl.pathname.slice(1) !== expectedDatabase) {
  throw new Error('The ranking verification target does not match the reviewed database target.')
}
databaseUrl.searchParams.set('sslmode', 'verify-full')

const client = new Client({ connectionString: databaseUrl.toString() })
try {
  await client.connect()
  const result = await client.query(
    'SELECT name, website, vote_count::text AS votes FROM api.public_rankings WHERE game_slug = $1 ORDER BY vote_count DESC, created_at ASC, id ASC LIMIT 100',
    [gameSlug],
  )
  console.log(JSON.stringify(result.rows))
} finally {
  await client.end()
}
