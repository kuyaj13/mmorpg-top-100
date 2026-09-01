# Phase 4: Neon public rankings foundation

## Implemented boundary

- Neon PostgreSQL 17 is the canonical replacement database.
- Cloudflare Hyperdrive connects as `hyperdrive_reader`, a manually created PostgreSQL role with no inherited Neon administrator membership.
- The runtime role can use only the `api` schema and select from `api.public_games` and `api.public_rankings`.
- The Worker exposes `GET /api/games/:gameSlug/rankings` with a strict slug, game isolation, active-only records, deterministic ordering, and a hard 100-row limit.
- The response includes only game slug/name and server ID/name/vote count. Owner, moderation, authentication, submission, and advertising data are not exposed.
- Vote counts are display-only imported totals in this phase. Voting remains disabled until immutable vote records and abuse controls are implemented.
- Individual game pages use the live read-only rankings API and show an honest empty state when no approved servers exist. They render only verified server name, vote count, and rank data returned by the public contract.
- The homepage remains explicitly labeled sample preview until approved server data exists; it is not presented as live ranking data.
- The canonical 82-game catalog is seeded in production and verified by total, active, unique-slug, and game-type counts.
- The read-only Worker is deployed at `https://api.mmorpgtop100.com`; its `workers.dev` route is disabled.
- The static frontend is deployed on the Cloudflare Pages Free plan at `https://mmorpg-top-100.pages.dev`. Static routes use an SPA fallback and receive restrictive security headers.
- CORS permits only the exact apex production origin and the exact production Pages origin. Branch preview hostnames and lookalike origins remain excluded.

## Cost boundary

- Keep Neon on its `$0` Free plan and Cloudflare on Workers/Pages Free. Do not enable Workers Paid, advanced WAF, paid observability, Pages Functions, or usage-billed storage for this phase.
- The frontend contains static assets only. It has no Pages Functions, so static page requests do not consume the Worker request quota.
- The public API remains subject to Cloudflare's Free-plan Worker cap and the application rate limiter. Reaching a free quota may make the service temporarily unavailable; it must not trigger an automatic paid upgrade.

## Migration safety

- The first migration was tested on the expiring `phase-4-public-rankings` child branch before production.
- Migrations use the owner role over a direct, unpooled connection; Hyperdrive never runs migrations.
- `npm run db:migrate` refuses pooled URLs, requires `ALLOW_DATABASE_MIGRATION=true`, and requires the connection hostname/database to exactly match `EXPECTED_DATABASE_HOST` and `EXPECTED_DATABASE_NAME`.
- `npm run db:seed-games` reads the single canonical catalog from `src/games/games.ts`, requires the same exact-target guard, uses parameterized values in one transaction, and commits only when all 82 active slugs are present and unique.
- A fresh project must create the restricted `hyperdrive_reader` role before applying the migration. Its password belongs only in Neon/Cloudflare control planes and must never be committed.
- Production permission tests confirmed the runtime role can read the public views and cannot insert into application tables.

## Remaining gate

- Import only approved servers with verified HTTPS destinations.
- Replace the homepage sample leaderboard only after approved server records exist; do not synthesize missing production metadata.
- Keep voting, submission, moderation, and paid-listing mutations fail-closed until their separate authorization and abuse-protection phases pass.
- The rankings endpoint calls the `RANKINGS_RATE_LIMITER` Worker binding before database access. It allows 60 requests per minute for each client/game key in each Cloudflare location and returns a plain `429` response before consuming a Hyperdrive query.
