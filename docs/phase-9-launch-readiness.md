# Phase 9: Launch readiness

## Cost and compatibility gate

- The public application uses the existing React build, Firebase Authentication, Neon Free PostgreSQL, and Cloudflare Workers/Pages Free configuration.
- Voting, server submission, administrator moderation, and free banner upload/moderation are enabled after separate compatibility, security, and regression gates.
- Donation claims, donation moderation, and paid placements remain disabled until their complete release gate passes.
- Do not add Firebase Functions, Secret Manager, another database, or another paid service without a new compatibility and cost review plus explicit product-owner approval.
- The approved replacement is Neon Free PostgreSQL 17 through a project-specific Cloudflare Hyperdrive configuration. Public rankings and approved authenticated mutations now use narrowly scoped database functions through the trusted Worker.
- Cloudflare Free does not accept a custom Worker CPU limit, so the preview Worker uses the plan's fixed platform limit without a `limits.cpu_ms` override.
- Before any production deployment, run `npm run release:check`. It fails closed if the banner limits drift between the public forms, Worker validation, administrator response validation, and the database migration contract, then runs lint, the complete test suite, the production build, and the Worker deployment dry-run.
- Unexpected Worker failures emit a structured, privacy-safe event containing a generated request ID, HTTP method, allowlisted route category, and error type only. The same request ID is returned in the 500 response header for support correlation; URLs, identifiers, credentials, submitted content, and database messages are excluded.
- The server-submission form displays a syntactically validated support reference only for unexpected server failures. It remains an accessible alert, while malformed or attacker-controlled reference headers are ignored.

## PostgreSQL trial exit

- The trial-exit target is the Neon Free PostgreSQL 17 project `ancient-haze-79240276` in `aws-ap-southeast-1`, linked to its `production` branch.
- Keep Firebase Authentication, but replace SQL Connect operations incrementally with authenticated Cloudflare Worker endpoints backed by Hyperdrive.
- Neon Auth is provisioned on the replacement database as requested, but it is not wired into the application; Firebase Authentication remains authoritative unless a separately reviewed authentication migration is approved.
- The production React application no longer imports either generated Firebase SQL Connect client. Server moderation and the advertising workspace now use authenticated Cloudflare Worker boundaries backed by narrowly scoped Neon functions.
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
- Mobile browser audit passed on 2026-09-06 at a 390 by 844 viewport with Fast 4G and 4x CPU throttling. The homepage recorded 660 ms LCP and 0.00 CLS; the homepage and submission page each scored 100 for accessibility, best practices, SEO, and agentic browsing with no failed Lighthouse audits.
- Remaining: keep donation claims, donation moderation, and exclusive placements disabled until a final manual financial-flow regression pass is approved.
- Automated financial-boundary regression for both 7-day and 30-day packages passed on a production-derived branch on 2026-09-09 with all test writes rolled back. The remaining gate is the human PayPal-record matching and administrator UI walkthrough; no payment is required for automated verification.
- Re-run the database boundary with `npm run db:verify-financial -- --branch <isolated-branch>`. The wrapper requires an explicit branch, refuses the production name and ID, verifies that the SQL retains its rollback boundary, and stops on the first SQL error.
- Homepage regression tests await the live-directory lifecycle before completing, so asynchronous React updates remain inside the test boundary and cannot hide later failures behind lifecycle warnings.
- Player, free-banner owner, and future advertiser verification screens consistently direct users to check both their inbox and spam folder while keeping private workspace data unloaded until verification succeeds.
