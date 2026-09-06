# Phase 9: Launch readiness

## Cost and compatibility gate

- The public application uses the existing React build, Firebase Authentication, Neon Free PostgreSQL, and Cloudflare Workers/Pages Free configuration.
- Voting, server submission, administrator moderation, and free banner upload/moderation are enabled after separate compatibility, security, and regression gates.
- Donation claims, donation moderation, and paid placements remain disabled until their complete release gate passes.
- Do not add Firebase Functions, Secret Manager, another database, or another paid service without a new compatibility and cost review plus explicit product-owner approval.
- The approved replacement is Neon Free PostgreSQL 17 through a project-specific Cloudflare Hyperdrive configuration. Public rankings and approved authenticated mutations now use narrowly scoped database functions through the trusted Worker.
- Cloudflare Free does not accept a custom Worker CPU limit, so the preview Worker uses the plan's fixed platform limit without a `limits.cpu_ms` override.

## PostgreSQL trial exit

- The trial-exit target is the Neon Free PostgreSQL 17 project `ancient-haze-79240276` in `aws-ap-southeast-1`, linked to its `production` branch.
- Keep Firebase Authentication, but replace SQL Connect operations incrementally with authenticated Cloudflare Worker endpoints backed by Hyperdrive.
- Neon Auth is provisioned on the replacement database as requested, but it is not wired into the application; Firebase Authentication remains authoritative unless a separately reviewed authentication migration is approved.
- Never commit the Neon connection string. Supply it only to Hyperdrive through Wrangler or the Cloudflare dashboard.
- Neon is the active production database. Keep any former SQL Connect resources untouched unless removal receives a separate, verified approval.

## Launch boundary

- Public rankings contain approved production records and remain independently scoped by game.
- Disabled actions must remain non-interactive and explain when they will become available.
- `/admin` is enabled only for verified administrator claims. `/advertise` exposes free banner management; donation and exclusive-placement controls remain fail-closed.
- The donation link is a public PayPal link only and grants no entitlement automatically.

## Remaining production gates

- Custom-domain routing, response security headers, CORS allowlisting, and hostile-origin rejection passed on 2026-09-06.
- Voting and submission use Firebase identity, server-verified Turnstile, Worker rate limits, validated inputs, and constrained database functions.
- Submission banners are optional and free. Actual request bytes are bounded; media is decoded and sanitized; quarantined storage is globally capped; moderation promotion/deletion is atomic.
- Remaining: complete a browser-based performance and accessibility trace when Chrome DevTools MCP is available.
- Remaining: keep donation claims, donation moderation, and exclusive placements disabled until a final manual financial-flow regression pass is approved.
