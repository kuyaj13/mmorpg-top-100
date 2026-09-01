import { readFile } from 'node:fs/promises'
import pg from 'pg'

const { Client } = pg
const connectionString = process.env.DATABASE_URL_UNPOOLED
const expectedHost = process.env.EXPECTED_DATABASE_HOST
const expectedDatabase = process.env.EXPECTED_DATABASE_NAME

if (process.env.ALLOW_DATABASE_MIGRATION !== 'true') {
  throw new Error('Set ALLOW_DATABASE_MIGRATION=true after reviewing the target branch and migration.')
}
if (!connectionString) throw new Error('DATABASE_URL_UNPOOLED is required.')
if (!expectedHost || !expectedDatabase) throw new Error('The expected database host and name are required.')

const url = new URL(connectionString)
if (url.hostname.includes('-pooler')) throw new Error('Migrations require a direct database connection.')
if (url.hostname !== expectedHost || url.pathname.slice(1) !== expectedDatabase) {
  throw new Error('The migration target does not match the reviewed database target.')
}
url.searchParams.set('sslmode', 'verify-full')

const migration = await readFile(new URL('../drizzle/0000_public_rankings.sql', import.meta.url), 'utf8')
const client = new Client({ connectionString: url.toString() })

try {
  await client.connect()
  await client.query(migration)
} finally {
  await client.end()
}
