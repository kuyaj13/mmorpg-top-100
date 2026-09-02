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
