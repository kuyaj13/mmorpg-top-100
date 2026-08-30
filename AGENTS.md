# Secure, Mobile-First, Accessible React Engineering Guide

You are part of a secure, mobile-first, accessible engineering team building a React MMORPG ranking website.

Project goal:
- Build a site similar to a top 100 MMORPG server ranking portal
- Players can vote for private servers
- Server owners can submit their own server
- Server owners can pay for featured placement and ads
- The site must work well on mobile browsers
- Accessibility and security must be part of the design from day one

Core product scope:
- Homepage
- Rankings page
- Server detail page
- Submission form
- Moderation/admin flow
- Paid listing sections
- Search/filtering and sorting
- Mobile-first responsive layout

Technology direction:
- Frontend: React + TypeScript
- Tooling: Vite
- Backend: Node.js + Express or NestJS
- Backend platform: Firebase, preferring Firebase SQL Connect where it fits the approved architecture
- Database: PostgreSQL through Firebase SQL Connect / managed Cloud SQL
- Authentication: Firebase Authentication
- App attestation: Firebase App Check
- Donation provider: a public PayPal donation URL with manual administrator review
- Hosting and security edge: Cloudflare is mandatory
- Mobile-first, accessible, secure implementation

Infrastructure decision:
- Prefer Firebase SQL Connect over Firestore for the core product data because rankings, ownership, unique votes, moderation history, and sponsorship entitlements require relational integrity.
- Use Firebase Authentication for player, owner, moderator, and administrator identity.
- Use Firebase App Check as an additional attestation layer; never treat it as a replacement for authentication, authorization, validation, or rate limiting.
- Host the frontend on Cloudflare Pages unless a later verified constraint requires another origin.
- Route public application and API traffic through Cloudflare wherever technically supported so WAF, DDoS protection, security rules, and endpoint-specific rate limits apply.
- Protect voting, submission, login, admin, donation-claim, and advertising entry points with Cloudflare controls appropriate to their risk.
- Use Cloudflare Turnstile for abuse-sensitive public forms and validate every token server-side; a client widget alone is not protection.
- Do not expose privileged Firebase credentials to the browser. Keep administrative and donation-verification operations in trusted server-side code.
- Direct Firebase client access, if used, must be narrowly authorized with Firebase rules or SQL Connect authorization and protected with App Check. Sensitive mutations should use a controlled server-side boundary.
- Keep origin services private or restricted where possible; Cloudflare must not be the only security control.
- Re-evaluate pricing and quotas before production launch and configure budget alerts.

Firebase CLI workflow:
- The Firebase CLI is installed globally and the approved workflow is `firebase login`, `firebase init`, and `firebase deploy`.
- Run `firebase login` interactively under the project owner's Firebase account; never request, store, or share account passwords or service-account private keys.
- Before `firebase init`, verify the selected Firebase project is `mmorpg-top-100` and preserve the existing `firebase.json`, `dataconnect/`, source files, and environment configuration.
- Initialize only the Firebase products required by the current approved phase. Do not enable unrelated products by default.
- Use local emulators and generated SQL Connect clients before deploying backend changes.
- Before every `firebase deploy`, run build, lint, tests, authorization checks, and the applicable mobile/accessibility/security regression gate.
- Verify the active Firebase project and explicit deployment targets immediately before deployment; avoid an unscoped production deploy when a narrower target is sufficient.
- Never place Firebase Admin credentials, PayPal account credentials, Cloudflare secrets, or service-account keys in frontend environment variables or committed files.

Engineering rules:
- Keep scope tight and implement in small phases
- Do not over-engineer early
- Do not mark work complete without regression verification
- Build small feature slices and verify before moving forward
- No phase advances without a regression pass

Regression gate:
Before moving to the next phase, do all of the following:
- build the app
- run lint
- check the key flows
- confirm mobile layout still works
- confirm accessibility basics still hold
- confirm no previous features were broken
- confirm no insecure or abusive behavior was introduced

Inline error rule:
- Inline errors must be plain, user-facing descriptions only
- Do not expose method names, function names, or technical implementation details
- Good:
  - This field is required.
  - Please enter a valid server URL.
  - This server is already pending review.
- Bad:
  - validateServerName failed
  - submitServerForm error
  - Invalid payload: method mismatch

Phase plan:
1. Scope lock and requirements freeze
2. App foundation
3. Public pages and landing shell
4. Ranking and server detail data flow
5. Voting system
6. Submission flow
7. Admin moderation
8. Paid listings and sponsorship
9. Security, accessibility, and launch readiness

Donation decision:
- Use only a public PayPal donation URL; do not implement automated PayPal checkout or webhooks.
- Donations never change organic votes or rankings and never grant advertising automatically.
- Advertising access uses a manually reviewed donation claim matched by an administrator against the PayPal account.
- Keep donation verification authoritative on the backend; never trust client-reported status, amount, currency, or entitlement.
- A unique donation reference may grant at most one placement entitlement.
- Store donation references only as needed for manual reconciliation; never collect or store card details or PayPal account credentials.
- Keep paid placement clearly labeled and separate from organic ranking calculations.

Advertising banner decision:
- Advertisers must be able to upload banner images during the Phase 8 advertising flow.
- Accept animated `.gif` banners in addition to approved static image formats.
- Validate the actual file signature and decoded media type on the trusted server side; never trust only the extension or browser-provided MIME type.
- Define and enforce banner dimensions, pixel count, file size, animation duration/frame limits, and upload frequency before enabling production uploads.
- Reject malformed files and strip unnecessary metadata where practical.
- Store uploads outside the application execution environment using generated object names; never use advertiser filenames as executable paths.
- Serve banners with fixed image content types, `nosniff`, and a restrictive content policy. Do not accept SVG, HTML, scripts, or arbitrary embedded content as banner uploads.
- Require moderation approval before a banner can be displayed publicly.
- Provide accessible alternative text and honor reduced-motion preferences for animated banners, including a non-animated presentation when needed.
- Keep advertiser destination URLs allowlisted to HTTPS, reviewable by moderators, and protected against unsafe redirects.

Exclusive server advertising decision:
- Add a dedicated `Exclusive Servers` section for approved paid server advertisements.
- Offer clearly defined 7-day and 30-day advertising durations.
- Exclusive placement is sponsored advertising and must be visually and semantically labeled as `Sponsored` or `Advertisement`.
- Keep Exclusive Servers completely separate from organic Top 1–100 rankings.
- Paid status must never add votes, change organic rank, or influence the organic ranking calculation.
- Organic Top 1–100 rankings are maintained independently for each supported game.
- Each exclusive placement must reference its server, advertiser, approved banner, destination URL, manually verified donation claim, start time, expiration time, and moderation status.
- Activate placement only after manual donation verification and moderation approval.
- Expire placement automatically at the end of its purchased 7-day or 30-day period.
- Define limited inventory and deterministic rotation/order rules before Phase 8 launch so advertisers cannot purchase undisclosed ranking influence.
- Limit initial Exclusive Server inventory to 3 simultaneously active advertisers per game across the exclusive tier; additional approved requests wait for availability.
- Keep expired, refunded, rejected, and suspended advertisements out of the public Exclusive Servers section.

Exclusive advertisement rotation rules:
- Allow multiple approved Exclusive Server advertisements for the same game and package period.
- Group active advertisements by game and rotate only among eligible advertisements in that game's Exclusive Servers section.
- Give advertisements with the same placement tier equal scheduled exposure using a deterministic round-robin rotation.
- Do not use vote count, organic rank, payment order, advertiser identity, or server popularity to favor one advertisement in an equal tier.
- Start each visitor or display slot at a distributed rotation offset so the first advertiser does not receive disproportionate exposure.
- Use a consistent default display interval, initially 15 seconds per banner, and make it configurable by administrators without changing purchased duration.
- The purchased 7-day or 30-day period is continuous calendar time from activation; time continues even when another eligible banner is currently displayed.
- Remove an advertisement from rotation immediately when it expires, is refunded, suspended, rejected, or otherwise becomes ineligible.
- Add newly activated advertisements to the next fair rotation cycle without resetting other advertisers' active periods.
- Rotation scheduling and eligibility must be calculated by trusted backend data, not controlled by browser parameters.
- Track auditable impressions for reporting and fairness review, but do not guarantee a fixed impression count unless a future product package explicitly says so.
- Pause automatic visual rotation while the banner has keyboard focus, while the pointer is over it where appropriate, or when the page is not visible.
- Provide manual previous/next controls when more than one advertisement is active, with accessible names and status announcements.
- Honor reduced-motion preferences by avoiding animated transitions and by presenting GIF banners in a non-animated form where technically practical.

Game page and content-isolation rules:
- Provide a separate route and reusable page component for each supported game, using a stable game identifier or slug such as `/games/flyff`.
- A selected game page must display only servers assigned to that game.
- Each game's organic Top 1–100 ranking is calculated independently from every other game.
- A selected game page must display only eligible Exclusive Server advertisements assigned to that same game.
- For example, `/games/flyff` may show only Flyff servers, the Flyff Top 1–100 ranking, and approved active Flyff exclusive advertisements.
- Never mix advertisements, vote totals, ranks, filters, or server detail results across game boundaries.
- Treat the game identifier from the URL or browser as untrusted input; backend queries must enforce the game relationship and eligibility rules.
- A server and its advertisement must reference an approved game record. Do not rely on advertiser-provided display text to determine placement.
- Unknown, unsupported, or inactive game slugs must return a clear not-found state and must not fall back to another game's listings or advertisements.
- Shared UI should use reusable game-page, ranking, server-detail, and exclusive-ad components rather than duplicating a separate implementation for every game.
- Search, sorting, filtering, pagination, and voting initiated from a game page must remain scoped to that game.
- Cross-game discovery may exist on the homepage or game directory, but it must be clearly separate from an individual game's ranking and advertising sections.
- The canonical initial game catalog is stored in `src/games/games.ts`.
- All entries in the initial supplied catalog are classified as the `MMORPG` game type.
- Additional supplied catalog groups retain their explicitly assigned game type, including `STRATEGY`.

Acceptance criteria per phase:
- work is implemented as planned
- feature behavior is tested
- user flows are correct
- mobile layout remains usable
- accessibility basics remain intact
- no regression is introduced

Recommended roles:
- Software Architect: system direction, boundaries, technical decisions
- Senior React Developer: UI architecture and React implementation
- Backend Architect: API design and service boundaries
- Database Administrator: schema, integrity, backup, and access safety
- Network Engineer: hosting, traffic, infra, and deployment concerns
- Accessibility Tester: mobile and keyboard usability review
- Security Reviewer: abuse protection, admin access, and release review
- Engineering Coordinator: keep scope, sequencing, and regression discipline intact

Workspace agent team:
- Treat the eight roles above as the persistent project team.
- Their full role instructions are stored in `agents/<Role Name>.md`.
- At the start of project work, read the role files relevant to the requested task.
- The primary agent acts as Engineering Coordinator unless the task requires a dedicated coordinator agent.
- Explicitly create and delegate to relevant specialist agents when their work can be performed independently or when their review is required by a phase gate.
- Do not recreate all agents for every request. Activate only the roles needed for the current feature slice or regression gate.
- When runtime agents are unavailable or session-limited, the primary agent must apply the relevant role instructions directly.
- Runtime agents are temporary, but these workspace role definitions and delegation rules persist across sessions.
- Respect the environment's concurrency limit and use batches when several specialist reviews are required.

Priority order:
1. correctness
2. security
3. accessibility
4. mobile usability
5. performance
6. extra polish

Important:
- Keep the project easy to reason about
- Favor working MVP behavior over feature bloat
- Keep technical details in logs, not in UI messages
- Keep the workflow incremental and disciplined

Do not do the following:
- present technical internal names to users
- skip regression checks
- leave accessibility gaps in mobile flows
- move to a new phase without verifying prior work
- add scope without explicit approval
