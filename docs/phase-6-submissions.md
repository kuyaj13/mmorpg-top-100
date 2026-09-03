# Phase 6: server submissions

## Locked backend rule

- A Firebase account with a verified email may submit a server for moderation review.
- Requests are rate-limited before authentication or database access and require a fresh Turnstile token with action `submit-server`.
- The Worker derives a domain-separated HMAC owner key. Raw Firebase user IDs, email addresses, IP addresses, and Turnstile tokens are not stored in PostgreSQL.
- Pending submissions never appear in public rankings until a later administrator moderation transaction approves them.

## App Check compatibility exception

Firebase App Check is omitted from this submission slice under the approved no-cost compatibility exception. The currently offered web provider may become billable, while the deprecated provider is not a durable production dependency. Verified Firebase Authentication, exact-origin CORS, server-validated Turnstile, Cloudflare rate limiting, HMAC-pseudonymous ownership, validation, and database constraints remain mandatory and independent. Revisit App Check if Firebase offers a durable no-cost compatible option.

## Database integrity

- `app.server_submissions` references an active catalog game through the submission function and stores only moderation candidates.
- Partial unique indexes prevent duplicate pending trimmed names within a game and allow only one pending submission per normalized hostname.
- Each pseudonymous owner may have at most three pending submissions. Website input is limited to a public DNS hostname on a homepage-only HTTPS URL using the default port.
- `api.submit_server` serializes cross-table duplicate checks so concurrent submissions cannot race an approved server or another pending submission.
- Hyperdrive receives only `EXECUTE` on the submission function, not table access.
