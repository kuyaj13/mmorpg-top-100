import { readFile } from 'node:fs/promises'
import pg from 'pg'

const { Client } = pg
const connectionString = process.env.DATABASE_URL_UNPOOLED
const expectedHost = process.env.EXPECTED_DATABASE_HOST
const expectedDatabase = process.env.EXPECTED_DATABASE_NAME

if (process.env.ALLOW_SERVER_IMPORT !== 'true') {
  throw new Error('Set ALLOW_SERVER_IMPORT=true after reviewing the approved server catalog and target branch.')
}
if (!connectionString || !expectedHost || !expectedDatabase) throw new Error('The database target is incomplete.')

const databaseUrl = new URL(connectionString)
if (databaseUrl.hostname.includes('-pooler')) throw new Error('Server imports require a direct database connection.')
if (databaseUrl.hostname !== expectedHost || databaseUrl.pathname.slice(1) !== expectedDatabase) {
  throw new Error('The server import target does not match the reviewed database target.')
}
databaseUrl.searchParams.set('sslmode', 'verify-full')

const servers = JSON.parse(await readFile(new URL('../data/approved-servers.json', import.meta.url), 'utf8'))
if (!Array.isArray(servers) || servers.length === 0 || servers.length > 100) throw new Error('The approved server catalog is invalid.')

const uniqueListings = new Set()
const uniqueWebsites = new Set()
for (const server of servers) {
  if (!server || typeof server !== 'object') throw new Error('An approved server entry is invalid.')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(server.gameSlug)) throw new Error('An approved game slug is invalid.')
  if (typeof server.name !== 'string' || server.name.trim() !== server.name || server.name.length < 2 || server.name.length > 80) {
    throw new Error('An approved server name is invalid.')
  }
  if (!Number.isSafeInteger(server.initialVotes) || server.initialVotes < 0) throw new Error('An initial vote count is invalid.')
  const website = new URL(server.website)
  if (website.protocol !== 'https:' || website.username || website.password || website.search || website.hash) {
    throw new Error('An approved server website is invalid.')
  }
  const listingKey = `${server.gameSlug}:${server.name.toLocaleLowerCase('en-US')}`
  if (uniqueListings.has(listingKey) || uniqueWebsites.has(website.href)) throw new Error('The approved server catalog contains a duplicate.')
  uniqueListings.add(listingKey)
  uniqueWebsites.add(website.href)
  server.website = website.href
}

const client = new Client({ connectionString: databaseUrl.toString() })
try {
  await client.connect()
  await client.query('BEGIN')
  for (const server of servers) {
    const game = await client.query('SELECT 1 FROM app.games WHERE slug = $1 AND is_active', [server.gameSlug])
    if (game.rowCount !== 1) throw new Error('An approved server references an unavailable game.')

    await client.query(
      `INSERT INTO app.servers (game_slug, name, website, status, vote_count)
       VALUES ($1, $2, $3, 'active', $4)
       ON CONFLICT (game_slug, name) DO NOTHING`,
      [server.gameSlug, server.name, server.website, server.initialVotes],
    )
    const result = await client.query(
      `SELECT game_slug, name, website, status, vote_count::text AS vote_count
         FROM app.servers
        WHERE game_slug = $1 AND name = $2`,
      [server.gameSlug, server.name],
    )
    const imported = result.rows[0]
    if (!imported || imported.website !== server.website || imported.status !== 'active' ||
      imported.vote_count !== String(server.initialVotes)) {
      throw new Error('An existing server does not match the approved import record.')
    }
  }
  await client.query('COMMIT')
  console.log(`APPROVED_SERVER_COUNT=${servers.length}`)
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  await client.end()
}
