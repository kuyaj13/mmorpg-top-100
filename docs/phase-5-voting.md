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
- Verify a fresh Cloudflare Turnstile token server-side and bind it to the expected hostname and action.
- Apply a stricter vote endpoint rate limit before authentication or database work.
- Keep all verification secrets in Cloudflare Worker secrets, never frontend variables or committed files.
- Return plain user-facing errors and never disclose whether a particular verification layer failed.

The voting UI and endpoint must remain disabled until every control above passes its regression gate.

## Implemented and activated

- The Worker verifies Firebase ID-token signatures and exact issuer, audience, verified-email, algorithm, type, expiry, and issued-time claims.
- Turnstile verification is server-side, single-attempt, time-bounded, and restricted to the `mmorpgtop100.com` hostname and `vote` action.
- A dedicated Cloudflare binding limits vote attempts to 6 per IP per minute before token or database work.
- The React flow provides player sign-in, account creation, email verification, a keyboard-accessible Turnstile control, non-optimistic totals, and live announcements.
- Voting was activated on September 2, 2026 after both Worker secrets, the production Turnstile widget, production migration, dedicated limiter, and regression gate were verified. The public Turnstile site key is committed in `.env.production`; secret values remain only in Cloudflare.

## Activation gate

1. Completed September 2, 2026: the production Turnstile widget was restricted to `mmorpgtop100.com`, and its private value was stored as Worker secret `TURNSTILE_SECRET`.
2. Completed September 2, 2026: a randomly generated 32-byte value was stored as the Worker secret `VOTER_HMAC_SECRET`; do not rotate it during a UTC voting day.
3. Completed September 2, 2026: migration `0002_secure_daily_votes.sql` was applied to production with the direct owner connection and passed rollback-only verification through both owner and restricted application roles.
4. Completed September 2, 2026: both feature flags were enabled, the full gate passed, the API was deployed and checked before Pages, and the live bundle was verified to contain the public site key and voting UI.

## No-cost App Check compatibility decision

The Firebase Console currently offers reCAPTCHA Enterprise for new App Check web registrations and marks the non-Enterprise reCAPTCHA provider deprecated. Enterprise has a free assessment allowance but can become billable above it; the deprecated option creates avoidable migration risk. The project owner therefore approved omitting App Check from Phase 5 voting rather than accepting a deprecated or potentially billable dependency. Verified Firebase Authentication, exact-origin enforcement, server-validated single-use Turnstile, Cloudflare rate limiting, HMAC-pseudonymous voter identity, and the PostgreSQL unique constraint remain mandatory and independent. This exception applies only to the voting endpoint and must be reviewed again if Firebase introduces a durable no-cost web attestation option.
