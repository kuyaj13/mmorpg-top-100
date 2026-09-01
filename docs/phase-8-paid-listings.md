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

- The owner workspace, verified-email account flow, owner-scoped claim contract, claim history, and protected administrator review queue are implemented locally.
- SQL Connect SDK generation succeeds for the advertiser and administrator connectors.
- Donation-claim creation is intentionally unavailable in the launch scope. The Cloudflare endpoint returns a plain temporary-unavailability response and cannot write product data.
- A Neon Free PostgreSQL 17 production database and a project-specific Cloudflare Hyperdrive configuration are provisioned and pass connection/configuration validation. The previous PostgreSQL 18 project remains untouched for rollback.
- Paid claims, banner uploads, and placement activation remain disabled until the trusted Worker repository, schema migrations, authorization checks, and abuse controls pass their own regression gate.
- Banner uploads remain intentionally unavailable until the trusted quarantine/scanning service and approved numeric media limits are implemented.
- Package prices still require product-owner approval before active package records are seeded.

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

- Initial allowed formats are GIF, PNG, JPEG, and WebP. SVG and arbitrary documents are rejected.
- Trusted upload processing must verify file signatures and decode the image before storage.
- Dimensions, pixel count, byte size, animation duration, frame count, metadata handling, and upload rate limits must be finalized before enabling production uploads.
- Storage uses generated object names and fixed response content types with `nosniff`.
- Destination URLs must be HTTPS and moderator-reviewable.
- Every banner requires meaningful alternative text and moderation approval.
- Validation records the decoded pixel/frame/duration limits, original content hash, and a static fallback object for reduced-motion presentation.

## Rotation and game isolation

- Public eligibility is calculated from the placement's server relationship, which references one canonical game.
- A game page queries only placements whose related server belongs to that game.
- Equal-tier placements use deterministic round robin with a distributed initial offset and a default 15-second interval.
- Browser-provided game IDs, eligibility flags, ranks, or time values are never authoritative.
- Automatic rotation pauses on keyboard focus, appropriate pointer hover, and hidden pages; manual controls are available when multiple banners are eligible.
