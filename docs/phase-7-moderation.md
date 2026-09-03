# Phase 7: administrator moderation

- Every endpoint requires a verified Firebase ID token whose custom `admin` claim is exactly `true`, a verified email, and recent authentication.
- Rate limiting runs before JWT verification or database work. Requests also require an exact configured browser origin.
- Administrator identifiers are stored only as domain-separated HMAC keys in append-only moderation history.
- Approval atomically locks and rechecks the pending submission, active game, server name, and website host before creating an active server and resolving the submission. Rejection atomically resolves it and records an allowlisted reason.
- The runtime database role can execute only the three moderation functions and cannot directly read or mutate private tables.

Firebase App Check remains omitted under the previously approved no-cost web compatibility exception. Admin authentication, authorization, recent-auth enforcement, exact-origin checks, endpoint rate limits, narrowly granted database functions, and audit history are independent mandatory controls. Revisit App Check if a durable no-cost compatible web option becomes available.

