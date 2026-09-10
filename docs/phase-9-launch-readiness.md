# Phase 9: Launch readiness

## Cost and compatibility gate

- The public application uses the existing React build, Firebase Authentication, Neon Free PostgreSQL, and Cloudflare Workers/Pages Free configuration.
- Voting, server submission, administrator moderation, and free banner upload/moderation are enabled after separate compatibility, security, and regression gates.
- Donation claim submission, donation moderation, verified-claim-only Exclusive banner uploads, scoped Exclusive-banner moderation, paid placement controls, and public sponsored ads are enabled after their independent release gates passed.
- Do not add Firebase Functions, Secret Manager, another database, or another paid service without a new compatibility and cost review plus explicit product-owner approval.
- The approved replacement is Neon Free PostgreSQL 17 through a project-specific Cloudflare Hyperdrive configuration. Public rankings and approved authenticated mutations now use narrowly scoped database functions through the trusted Worker.
- Cloudflare Free does not accept a custom Worker CPU limit, so the preview Worker uses the plan's fixed platform limit without a `limits.cpu_ms` override.
- Before any production deployment, run `npm run release:check`. It fails closed if the banner limits drift between the public forms, Worker validation, administrator response validation, and the database migration contract, then runs lint, the complete test suite, the production build, and the Worker deployment dry-run.
- Cloudflare Pages uses the separate `cloudflare-pages/wrangler.jsonc` source of truth and `npm run deploy:pages`. Keeping Pages configuration separate prevents Worker bindings and production variables from being applied to the static site and removes the ambiguous-config deployment warning.
- A point-in-time recovery drill completed on 2026-09-10 using an isolated, automatically expiring Neon branch. The recovered snapshot matched production for the core server, vote, submission, donation-claim, placement, public-ad, and impression-schema checks. The project's verified Free plan currently provides a six-hour restore window; operational recovery must therefore begin inside that window.
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
- `/admin` is enabled only for verified administrator claims. `/advertise` explains and accepts advertising requests, while `/advertise/banner` is the authenticated owner workspace for listing management and free or eligible Exclusive banner uploads.
- The donation link is a public PayPal link only and grants no entitlement automatically.

## Completed production gates

- Custom-domain routing, response security headers, CORS allowlisting, and hostile-origin rejection passed on 2026-09-06.
- Voting and submission use Firebase identity, server-verified Turnstile, Worker rate limits, validated inputs, and constrained database functions.
- Submission banners are optional and free. Actual request bytes are bounded; media is decoded and sanitized; quarantined storage is globally capped; moderation promotion/deletion is atomic.
- Mobile browser audit passed on 2026-09-06 at a 390 by 844 viewport with Fast 4G and 4x CPU throttling. The homepage recorded 660 ms LCP and 0.00 CLS; the homepage and submission page each scored 100 for accessibility, best practices, SEO, and agentic browsing with no failed Lighthouse audits.
- The manual financial-flow walkthrough and public Exclusive Servers release gate passed on 2026-09-10. Continue monitoring expiry, suspension, and game-isolation behavior without granting ranking influence.
- Automated financial-boundary regression for both 7-day and 30-day packages passed on a production-derived branch on 2026-09-09 with all test writes rolled back. The human PayPal-record matching and administrator UI walkthrough subsequently passed before public release.
- Re-run the database boundary with `npm run db:verify-financial -- --branch <isolated-branch>`. The wrapper requires an explicit branch, refuses the production name and ID, verifies that the SQL retains its rollback boundary, and stops on the first SQL error.
- Homepage regression tests await the live-directory lifecycle before completing, so asynchronous React updates remain inside the test boundary and cannot hide later failures behind lifecycle warnings.
- Player, free-banner owner, and future advertiser verification screens consistently direct users to check both their inbox and spam folder while keeping private workspace data unloaded until verification succeeds.
- Owners can edit an active listing through `/advertise/banner`; proposed changes remain non-public until administrator approval, and the moderation screen compares current and proposed values. Owners can also remove their listing immediately through a keyboard-accessible confirmation without deleting retained votes or moderation history.
- Owner listing edits provide field-specific, accessible validation and focus the first invalid field. The removal dialog supports Escape dismissal and restores focus to its trigger.

## Operational follow-ups

- The live 7-day placement has an exact database interval from 2026-09-09 16:37:07 UTC to 2026-09-16 16:37:07 UTC (2026-09-17 00:37:07 Asia/Manila). Its automatic removal must be observed at that real boundary; do not shorten or alter a customer's active entitlement merely to complete the check early.
- Neon is verified on `free_v3`. Review Neon usage and Cloudflare Workers/Pages usage in their dashboards, and enable the available account email notifications there. The current CLI authorization can deploy Workers and Pages but cannot administer account notification policies, so that dashboard-only control remains an owner action.
- Search indexing and production-error monitoring are ongoing operations rather than release blockers.
