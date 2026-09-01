import pg from 'pg'

const { Client } = pg
const baseUrl = process.env.BASE_DATABASE_URL
const password = process.env.READER_PASSWORD

if (!baseUrl || !password) throw new Error('Database verification environment is incomplete.')

const url = new URL(baseUrl)
url.username = 'hyperdrive_reader'
url.password = password

const client = new Client({ connectionString: url.toString() })
async function mustBeDenied(statement) {
  try {
    await client.query(statement)
    return false
  } catch {
    return true
  }
}

try {
  await client.connect()
  const identityResult = await client.query(`
    SELECT current_user AS name, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls,
           (SELECT count(*)::int FROM pg_auth_members WHERE member = pg_roles.oid) AS memberships
      FROM pg_roles
     WHERE rolname = current_user
  `)
  const identity = identityResult.rows[0]
  const gamesResult = await client.query('SELECT count(*)::int AS count FROM api.public_games')
  const rankingsResult = await client.query('SELECT count(*)::int AS count FROM api.public_rankings')
  const denials = await Promise.all([
    mustBeDenied('SELECT count(*) FROM app.games'),
    mustBeDenied('SELECT count(*) FROM app.servers'),
    mustBeDenied("INSERT INTO app.games(slug, name, game_type) VALUES ('must-not-write', 'Must Not Write', 'MMORPG')"),
    mustBeDenied("UPDATE app.games SET name = name WHERE slug = 'must-not-write'"),
    mustBeDenied("DELETE FROM app.games WHERE slug = 'must-not-write'"),
    mustBeDenied('CREATE TABLE public.must_not_create (id integer)'),
    mustBeDenied('CREATE TABLE app.must_not_create (id integer)'),
    mustBeDenied('CREATE TABLE api.must_not_create (id integer)'),
  ])
  const safeIdentity = identity?.name === 'hyperdrive_reader'
    && !identity.rolsuper && !identity.rolcreatedb && !identity.rolcreaterole
    && !identity.rolreplication && !identity.rolbypassrls && identity.memberships === 0
  if (!safeIdentity || denials.some((denied) => !denied)) {
    throw new Error('The runtime database role has privileges outside the public read boundary.')
  }
  console.log(`READ_OK=${Number.isInteger(gamesResult.rows[0]?.count) && Number.isInteger(rankingsResult.rows[0]?.count)}`)
  console.log(`ROLE_RESTRICTED=${safeIdentity}`)
  console.log(`PRIVILEGES_RESTRICTED=${denials.every(Boolean)}`)
} finally {
  await client.end()
}
