# Phase 4: Neon public rankings foundation

## Implemented boundary

- Neon PostgreSQL 17 is the canonical replacement database.
- Cloudflare Hyperdrive connects as `hyperdrive_reader`, a manually created PostgreSQL role with no inherited Neon administrator membership.
- The runtime role can use only the `api` schema and select from `api.public_games` and `api.public_rankings`.
- The Worker exposes `GET /api/games/:gameSlug/rankings` with a strict slug, game isolation, active-only records, deterministic ordering, and a hard 100-row limit.
- The response includes only game slug/name and server ID/name/vote count. Owner, moderation, authentication, submission, and advertising data are not exposed.
- Vote counts are display-only imported totals in this phase. Voting remains disabled until immutable vote records and abuse controls are implemented.
- The sample-data frontend remains unchanged until the canonical game catalog and approved server data are seeded and verified.

## Migration safety

- The first migration was tested on the expiring `phase-4-public-rankings` child branch before production.
- Migrations use the owner role over a direct, unpooled connection; Hyperdrive never runs migrations.
- `npm run db:migrate` refuses pooled URLs, requires `ALLOW_DATABASE_MIGRATION=true`, and requires the connection hostname/database to exactly match `EXPECTED_DATABASE_HOST` and `EXPECTED_DATABASE_NAME`.
- A fresh project must create the restricted `hyperdrive_reader` role before applying the migration. Its password belongs only in Neon/Cloudflare control planes and must never be committed.
- Production permission tests confirmed the runtime role can read the public views and cannot insert into application tables.

## Remaining gate

- Seed and validate all canonical games from `src/games/games.ts` before connecting the frontend.
- Import only approved servers with verified HTTPS destinations.
- Keep voting, submission, moderation, and paid-listing mutations fail-closed until their separate authorization and abuse-protection phases pass.
- Do not deploy the public Worker endpoint until its Cloudflare endpoint-specific rate-limit rule is verified.
