# Phase 5: secure voting

## Locked MVP rule

- A verified Firebase account may record one vote for an active server per UTC calendar day.
- Voting stays scoped to the server's authoritative game relationship and never accepts a browser-provided game, rank, or vote total.
- Paid or sponsored status never changes vote eligibility or organic ranking.

## Integrity boundary

- `app.votes` stores append-only vote events. A unique database constraint prevents the same derived voter key from voting for the same server twice in one UTC day.
- The Worker derives a 32-byte HMAC voter key from the verified Firebase user ID. Raw user IDs, email addresses, IP addresses, and Turnstile tokens are not stored in PostgreSQL.
- `api.cast_daily_vote` is the only write capability granted to the Hyperdrive role. It checks active server/game eligibility, inserts idempotently, and increments the cached server total in the same transaction.
- The public ranking views remain read-only and expose only the aggregate count.

## Required release controls

- Verify Firebase ID tokens server-side and require a verified email address.
- Verify Firebase App Check tokens server-side.
- Verify a fresh Cloudflare Turnstile token server-side and bind it to the expected hostname and action.
- Apply a stricter vote endpoint rate limit before authentication or database work.
- Keep all verification secrets in Cloudflare Worker secrets, never frontend variables or committed files.
- Return plain user-facing errors and never disclose whether a particular verification layer failed.

The voting UI and endpoint must remain disabled until every control above passes its regression gate.

## Implemented but disabled

- The Worker verifies Firebase ID and App Check JWT signatures and exact issuer, audience, application, verified-email, algorithm, type, expiry, and issued-time claims.
- Turnstile verification is server-side, single-attempt, time-bounded, and restricted to the `mmorpgtop100.com` hostname and `vote` action.
- A dedicated Cloudflare binding limits vote attempts to 6 per IP per minute before token or database work.
- The React flow provides player sign-in, account creation, email verification, a keyboard-accessible Turnstile control, non-optimistic totals, and live announcements.
- `VOTING_ENABLED` and `VITE_VOTING_ENABLED` default to false. Missing verification configuration cannot expose voting.

## Activation gate

1. Create the production Turnstile widget for only `mmorpgtop100.com` and store its secret as the Worker secret `TURNSTILE_SECRET`.
2. Register the production Firebase web app with App Check and place only its public site key in the Pages build environment as `VITE_FIREBASE_APP_CHECK_SITE_KEY`.
3. Store a randomly generated 32-byte or longer value as the Worker secret `VOTER_HMAC_SECRET`; do not rotate it during a UTC voting day.
4. Completed September 2, 2026: migration `0002_secure_daily_votes.sql` was applied to production with the direct owner connection and passed rollback-only verification through both owner and restricted application roles.
5. Enable both feature flags, rebuild, run the full gate, deploy API first, smoke-test, then deploy Pages.
