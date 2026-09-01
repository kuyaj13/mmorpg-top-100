import { readFile } from 'node:fs/promises'
import pg from 'pg'

const { Client } = pg
const connectionString = process.env.DATABASE_URL_UNPOOLED
const expectedHost = process.env.EXPECTED_DATABASE_HOST
const expectedDatabase = process.env.EXPECTED_DATABASE_NAME

if (process.env.ALLOW_GAME_SEED !== 'true') throw new Error('Set ALLOW_GAME_SEED=true after reviewing the target branch.')
if (!connectionString || !expectedHost || !expectedDatabase) throw new Error('The database target is incomplete.')

const url = new URL(connectionString)
if (url.hostname.includes('-pooler')) throw new Error('Game seeding requires a direct database connection.')
if (url.hostname !== expectedHost || url.pathname.slice(1) !== expectedDatabase) {
  throw new Error('The game seed target does not match the reviewed database target.')
}
url.searchParams.set('sslmode', 'verify-full')

const source = await readFile(new URL('../src/games/games.ts', import.meta.url), 'utf8')
const typeByFactory = new Map([
  ['mmorpg', 'MMORPG'],
  ['strategy', 'STRATEGY'],
  ['rpg', 'RPG'],
  ['general', 'GENERAL'],
  ['fps', 'FPS'],
  ['consolePlatform', 'CONSOLE'],
])
const games = [...source.matchAll(/^\s*(mmorpg|strategy|rpg|general|fps|consolePlatform)\('([^']+)', '([^']+)'\),?$/gm)]
  .map(([, factory, slug, name]) => ({ slug, name, gameType: typeByFactory.get(factory) }))

if (games.length !== 82 || games.some(({ gameType }) => !gameType)) throw new Error('The canonical game catalog could not be verified.')
if (new Set(games.map(({ slug }) => slug)).size !== games.length) throw new Error('The canonical game catalog contains duplicate slugs.')

const values = []
const placeholders = games.map(({ slug, name, gameType }, index) => {
  values.push(slug, name, gameType)
  const offset = index * 3
  return `($${offset + 1}, $${offset + 2}, $${offset + 3}, true)`
})

const client = new Client({ connectionString: url.toString() })
try {
  await client.connect()
  await client.query('BEGIN')
  await client.query(
    `INSERT INTO app.games (slug, name, game_type, is_active)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name,
           game_type = EXCLUDED.game_type,
           is_active = true`,
    values,
  )
  const result = await client.query(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE is_active)::int AS active,
           count(DISTINCT slug)::int AS distinct_slugs
      FROM app.games
  `)
  const counts = result.rows[0]
  if (counts.total !== 82 || counts.active !== 82 || counts.distinct_slugs !== 82) {
    throw new Error('The seeded game catalog did not pass count verification.')
  }
  await client.query('COMMIT')
  console.log('GAME_CATALOG_COUNT=82')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  await client.end()
}
