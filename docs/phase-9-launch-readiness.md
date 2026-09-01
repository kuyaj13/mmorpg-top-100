# Phase 9: Launch readiness

## Cost and compatibility gate

- The initial launch is a read-only public preview using the existing React build, sample catalog, Firebase Authentication configuration, SQL Connect schema, and Cloudflare Worker free-tier configuration.
- Voting, server submission, administrator moderation, donation claims, banner uploads, and paid placements are disabled in public routing until each has a compatible trusted backend and a separate regression gate.
- Do not add Firebase Functions, Secret Manager, Hyperdrive, another Cloud SQL instance, or another paid service without a new compatibility and cost review plus explicit product-owner approval.
- Hyperdrive remains excluded while the database runs PostgreSQL 18 outside Cloudflare's documented supported range.
- Cloudflare Free does not accept a custom Worker CPU limit, so the preview Worker uses the plan's fixed platform limit without a `limits.cpu_ms` override.

## PostgreSQL trial exit

- The selected trial-exit target is a Neon Free PostgreSQL 17 project, subject to a fresh quota and compatibility review immediately before migration.
- Keep Firebase Authentication, but replace SQL Connect operations incrementally with authenticated Cloudflare Worker endpoints backed by Hyperdrive.
- Never commit the Neon connection string. Supply it only to Hyperdrive through Wrangler or the Cloudflare dashboard.
- Do not remove the SQL Connect service until schema import, row-count checks, authorization tests, and rollback verification pass.

## Launch boundary

- Public ranking content is explicitly sample data and must not be described as live or authoritative.
- Disabled actions must remain non-interactive and explain when they will become available.
- The `/admin` and `/advertise` workspaces remain fail-closed.
- The donation link is a public PayPal link only and grants no entitlement automatically.

## Remaining production gates

- Verify Cloudflare Pages/custom-domain routing, WAF, and origin restrictions before calling the preview production-ready.
- Verify Firebase App Check enforcement server-side before enabling any SQL Connect client operation.
- Add durable, abuse-protected voting and submission slices before enabling those controls.
- Correct the moderation transaction so approval creates a canonical game-scoped server before enabling `/admin`.
