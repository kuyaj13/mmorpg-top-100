# Phase 8: Paid listings and sponsorship

## Manual donation boundary

- The approved public donation URL is `https://www.paypal.com/paypalme/VivaMU` and is defined once in `src/config/site.ts`.
- The public PayPal donation URL is separate from application authentication and never grants benefits automatically.
- An advertiser may submit a donation claim, but cannot set its verification status, package duration, start time, or expiration time.
- An administrator manually matches the claim to the PayPal account before marking it verified.
- A placement is activated only after manual donation verification and separate banner moderation approval.
- `DonationClaim.donorReference` is unique so the same donation cannot grant more than one entitlement.
- Refunds, reversals, moderation suspension, rejection, and expiration remove a placement from public eligibility immediately.

### Current implementation status

- The owner workspace and free, moderated banner workflow are live for approved server owners.
- The trusted Worker donation-claim submission boundary, administrator donation review, verified-claim-only Exclusive banner upload, scoped Exclusive-banner moderation, placement management, and public sponsored-ad display are enabled in production.
- The complete owner advertising workspace has independent frontend and Worker release flags. Claim submission is enabled, while every later paid-advertising stage remains separately fail-closed.
- Every paid route also requires one master release gate in addition to its individual kill switch. The master gate is enabled for the staged rollout, while each later capability remains protected by its own disabled flag.
- The authenticated advertising workspace now loads owned servers, server-defined packages, and owner-scoped claim history through Cloudflare and narrowly granted Neon functions. It no longer depends on the generated Firebase SQL Connect client.
- The administrator donation-review boundary is implemented through the trusted Worker, validated on an isolated branch, and enabled in production. Donation verification alone cannot activate advertising; a separately moderated Exclusive banner is also required.
- Placement reconciliation is installed in production for the no-cost Worker/PostgreSQL stack. It expires elapsed placements, suspends ineligible records, queues eligible verified claims, and promotes waiting placements without requiring a paid scheduler. Full reconciliation is throttled to once per game every 15 seconds; public eligibility still hides expired or invalid advertisements immediately.
- The complete placement lifecycle passed a rollback-only test on an expiring production-derived Neon branch on 2026-09-09: three-slot enforcement, deterministic waiting inventory, promotion, suspension, capacity-safe reactivation without extending paid time, and expiration all passed without persistent test data.
- The financial activation boundary passed a rollback-only test on a production-derived Neon branch on 2026-09-09: verification alone, free banners, and pending Exclusive banners granted no placement; server-owned amount, currency, and duration remained authoritative; repeated verification was idempotent; and approved Exclusive banners activated exactly one placement for both the 7-day and 30-day packages with exact expiration intervals.
- Claim submission accepts only an owned server, a server-defined package code, a unique PayPal reference, and a server-verified Turnstile token. Amount, currency, status, duration, and eligibility cannot be supplied by the browser.
- A successful claim response is added immediately to the owner's claim history and then reconciled with a no-store workspace request. A failed refresh retains the confirmed pending claim and success message instead of falsely reporting that submission failed.
- The Exclusive banner selector is populated by a separate owner-scoped database function and includes only active servers with a verified donation claim. The upload mutation independently enforces the same rule, so pending or rejected claims cannot become eligible through browser manipulation.
- Both free and Exclusive upload routes have explicit browser-preflight regression coverage for `PUT` and the required authorization, media, alternative-text, and Turnstile headers.
- Approving an eligible Exclusive banner invokes placement reconciliation in the same database transaction. Existing verified-and-approved records are reconciled by the migration, preventing a released public endpoint or browser refresh from being required to start or queue the purchased placement.
- Administrators compare PayPal records manually. Verification records the package amount and currency from the database, uses a recent administrator login, and appends an immutable decision event; browser-supplied financial values are not accepted.
- A Neon Free PostgreSQL 17 production database and a project-specific Cloudflare Hyperdrive configuration are provisioned and pass connection/configuration validation. The previous PostgreSQL 18 project remains untouched for rollback.
- Claim submission, donation review, verified-claim-only Exclusive banner uploads, scoped Exclusive-banner moderation, placement activation controls, and public advertising are enabled after independent release gates.
- Exclusive paid-banner uploads have a separate production kill switch and accept uploads only for an active owner server with a verified donation claim. Uploads remain pending and non-public until the separate moderation gate is enabled.
- Exclusive banner listing, static preview, and moderation are database-scoped behind a separate enabled flag. Only pending Exclusive banners enter this administrator review, and approval alone cannot make them public while placement and public-ad gates remain off.
- Administrator placement management has a separate fail-closed production flag; general administrator access cannot expose or mutate placements before release approval.
- Free banner uploads and moderation are enabled with the approved no-cost MVP limits below; a donation is never required to upload a banner.
- Package prices are server-owned records and are never accepted from the browser.
- Owner and administrator views show both the formatted amount and explicit `USD` currency; UI regression coverage confirms the 30-day selection submits only the server-owned `exclusive_30_day` package code.
- Administrator placement suspension and reactivation require an explicit keyboard-accessible confirmation. Failed decisions recover focus and controls without exposing technical errors, and successful decisions reload server-owned inventory counts.
- The placement-management client sends a freshly authenticated administrator token in the authorization header and only an allowlisted decision plus a fresh operation identifier. It rejects malformed, non-HTTPS, unsupported-duration, or unbounded placement records before rendering them.

## Package rules

- Initial package codes are `exclusive_7_day` and `exclusive_30_day`.
- `exclusive_7_day` costs USD $10.00 (`1000` minor units).
- `exclusive_30_day` costs USD $20.00 (`2000` minor units).
- Durations are exactly 7 or 30 continuous calendar days from activation.
- Each game allows at most 3 simultaneously active Exclusive Server advertisers across the initial exclusive tier.
- When all 3 positions for a game are active, additional approved requests must wait for inventory rather than displacing an active advertiser.
- Paid placement never changes votes, rating, or organic rank.
- Inventory and price remain server-owned configuration and are not accepted from browser input.
- A unique verified donation claim can grant at most one placement.
- Activation verifies the reviewed amount and currency against the selected active package.

## Banner rules

- Initial allowed formats are GIF, PNG, and JPEG. SVG, WebP, and arbitrary documents are rejected.
- Trusted upload processing must verify file signatures and decode the image before storage.
- Dimensions, pixel count, byte size, animation duration, frame count, metadata handling, and upload rate limits must be finalized before enabling production uploads.
- Storage uses generated object names and fixed response content types with `nosniff`.
- Destination URLs must be HTTPS and moderator-reviewable.
- Every banner requires meaningful alternative text and moderation approval.
- Validation records the decoded pixel/frame/duration limits, original content hash, and a static fallback object for reduced-motion presentation.

### No-cost Worker MVP limits

- One free banner record per approved server. Upload and replacement require only verified ownership of that server; they never require a donation.
- Exact dimensions: 468 by 60 pixels. Maximum encoded size: 512 KiB. Allowed signatures: PNG, JPEG, and GIF.
- Free 468 by 60 GIF limit: 45 frames and 15 seconds total declared frame delay. The decoded pixel-work ceiling is exactly 45 full-size frames. Static formats are recorded as one frame with zero animation duration.
- Both submission and owner-upload forms disclose the GIF frame limit and perform a lightweight client-side frame count so an over-limit file receives a plain inline banner-field error before upload. The trusted Worker independently decodes and enforces the same limit.
- Alternative text is required and limited to 180 characters. Replacements return to pending moderation.
- Banner bytes stay in PostgreSQL `bytea` for the no-cost MVP. Public responses use the stored fixed media type, `nosniff`, a restrictive content policy, and only the approved server website as destination.
- Donation claims and Exclusive placement features are live behind independent emergency kill switches. Banner uploads use trusted decoding and a generated static fallback before storage.

## Rotation and game isolation

- Public eligibility is calculated from the placement's server relationship, which references one canonical game.
- A game page queries only placements whose related server belongs to that game.
- Equal-tier placements use deterministic round robin with a distributed initial offset and a default 15-second interval.
- Browser-provided game IDs, eligibility flags, ranks, or time values are never authoritative.
- Public responses include the backend-owned placement expiry so an open game page removes the banner at the entitlement boundary without requiring a refresh.
- Open, visible game pages revalidate sponsored eligibility once per minute and immediately after returning from a hidden tab. Hidden pages do not poll, keeping database traffic bounded while removing suspended or otherwise ineligible ads without requiring a manual refresh.
- Automatic rotation pauses on keyboard focus, appropriate pointer hover, and hidden pages; manual controls are available when multiple banners are eligible.
