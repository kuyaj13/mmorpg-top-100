import { bigint, boolean, check, customType, date, index, pgSchema, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const app = pgSchema('app')

export const games = app.table('games', {
  slug: varchar('slug', { length: 100 }).primaryKey(),
  name: varchar('name', { length: 120 }).notNull(),
  gameType: varchar('game_type', { length: 30 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
}, (table) => [
  unique('games_name_unique').on(table.name),
  check('games_slug_format', sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`),
  check('games_name_not_blank', sql`btrim(${table.name}) <> ''`),
  check('games_type_allowed', sql`${table.gameType} IN ('MMORPG', 'STRATEGY', 'RPG', 'GENERAL', 'FPS', 'CONSOLE')`),
])

export const servers = app.table('servers', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameSlug: varchar('game_slug', { length: 100 }).notNull().references(() => games.slug, { onDelete: 'restrict', onUpdate: 'restrict' }),
  name: varchar('name', { length: 80 }).notNull(),
  website: text('website').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  voteCount: bigint('vote_count', { mode: 'bigint' }).notNull().default(0n),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('servers_name_per_game_unique').on(table.gameSlug, table.name),
  unique('servers_website_unique').on(table.website),
  check('servers_name_not_blank', sql`btrim(${table.name}) <> ''`),
  check('servers_website_https', sql`${table.website} ~* '^https://'`),
  check('servers_status_allowed', sql`${table.status} IN ('active', 'inactive', 'suspended')`),
  check('servers_votes_nonnegative', sql`${table.voteCount} >= 0`),
  index('servers_public_ranking_idx').on(table.gameSlug.asc(), table.voteCount.desc(), table.createdAt.asc(), table.id.asc()).where(sql`${table.status} = 'active'`),
])

const bytea = customType<{ data: Uint8Array }>({ dataType: () => 'bytea' })

export const votes = app.table('votes', {
  id: bigint('id', { mode: 'bigint' }).primaryKey().generatedAlwaysAsIdentity(),
  serverId: uuid('server_id').notNull().references(() => servers.id, { onDelete: 'restrict', onUpdate: 'restrict' }),
  voterKey: bytea('voter_key').notNull(),
  votingDay: date('voting_day').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('votes_one_per_server_day').on(table.serverId, table.voterKey, table.votingDay),
  check('votes_voter_key_length', sql`octet_length(${table.voterKey}) = 32`),
  index('votes_server_created_idx').on(table.serverId, table.createdAt.desc()),
])
