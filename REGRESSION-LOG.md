# Regression log

## VPS operations container — 2026-09-08

- Used the owner's supplied SSH access to inspect the dedicated Ubuntu 24.04
  VPS. One CPU, approximately 2 GB RAM and 46 GB free disk; no application
  listeners or existing container runtime. No firewall, DNS or SSH edits.
- Installed twelve new container-runtime packages; no existing packages upgraded
  or removed. Added one non-login service user, rootless storage, release/state
  directories and a user Quadlet. Disabled only newly installed rootful Podman
  service/socket and automatic-update timer; no existing service replaced.
- Initial non-root commands inherited an inaccessible working directory and
  root session bus. Corrected the working directory and explicit service-user
  runtime/bus environment; rootless mode and systemd cgroups then verified.
- Five new tests passed: field allowlists/provenance, missing vs zero, old/future
  rejection, bounded fixed-source fetching, publication withdrawal, seven-day
  retention, slot deduplication, preservation of unrelated files and 503 states.
  All 61 repository tests, TypeScript and both Worker dry-run builds passed.
- Restricted Wrangler compiler access failed on ancestor-directory access;
  scoped unsandboxed dry runs passed. Logs remain in ignored `.evidence/`.
- Release transfer SHA-256 matched at both ends. Official Node image digest
  pinned in Containerfile; build completed without runtime dependencies.
- Real collection succeeded at 06:37 UTC. Container runs as UID/GID 1000 with
  read-only rootfs, 192 MiB memory limit, CPU quota 25000/100000 and 64 PIDs.
  Listening socket is only 127.0.0.1:9081; public listeners remain SSH only.
  Snapshot files contain approved aggregate keys, not raw payloads or grants.
- A live field-coverage check caught the query-string sanitizer omitting valid
  Bluesky `actor` and DecAPI `id=true` attribution URLs. Added narrowly pinned
  public URL exceptions and a regression test; arbitrary token/query fields
  remain rejected. Release 2026-09-08.1 records this correction separately.
- Manual service restart recovered to healthy, retained one file per time slot,
  and denied POST with 405. The user default target includes the service and
  lingering is enabled; no full VPS reboot was performed.
- Final 2026-09-08.1 container is healthy. At 06:41 UTC it retained Instagram
  totals/sample metrics, TikTok sample averages, Twitch follower/viewer counts,
  Bluesky counters and GitHub counters with their original source dates.
  TikTok follower totals remain absent. Full suite now passes 62 tests.
  About 19 MB container memory was observed after startup; the 192 MiB cap,
  quarter-CPU limit and loopback binding are enforced by the runtime.
  Prior release/image retained for rollback; no user files deleted.

## OAuth connection foundation — 2026-09-08

- Added a staged vault and separate unapplied connection schema in response to
  the user's OAuth/retention proposal. The deployed read-only Worker does not
  import this module or expose token routes. No credentials or grants collected.
- Tests cover authenticated encryption, tenant/account substitution, tampering,
  null cross-tenant reads, separate sharing, reauthorization reset, bounded hold
  periods, hourly-validation/access-expiry gates, cascade deletion, and atomic
  browser-bound state replay prevention. Production login remains unfinished.
- Initial vault test load failed because Node's strip-only TypeScript runner
  does not support constructor parameter properties. Replaced them with explicit
  class fields without changing runtime behavior or upgrading dependencies.
- Final full suite: 56 tests passed; TypeScript passed. Secret/database handles
  use runtime-private fields to avoid accidental serialization. Connection DB
  schema remains unapplied and the vault is excluded from deployed entrypoints.

## Stratus Social and media-kit redesign — 2026-09-08

- Existing repositories began clean on main. Supplied logo preserved unchanged.
- First local preview rejected a compatibility date newer than the installed
  runtime. Aligned the new Worker to the supported 2026-09-04 date; no dependency
  upgrade or production configuration change was needed for this correction.
- Initial restricted-network check could not refresh Wrangler authentication;
  network-enabled read-only check confirmed valid deployment access.
- Generated both Worker binding types and TypeScript passed. Further tests,
  browser checks and deployments pending; no success claimed for those yet.
- Current published data confirms Instagram counters, TikTok video sample
  metrics, Twitch public counters, Bluesky and GitHub. Missing TikTok profile
  scope, YouTube, X and other unconnected accounts are not invented.
- Supplied X starter: all 23 fixture/mock tests passed independently. Review in
  X-STARTER-REVIEW.md; no live unofficial or paid X collection activated.
- Local runtime rate-limit bindings raised opaque internal errors, including
  on an isolated dev process. Static documentation, assets and health are now
  independent of collection limits; API/profile reads still fail closed. Mock
  tests cover denial and failure. Production binding behavior must be checked
  before the creator site is pointed at the new Worker.
- Redesigned charts separate source URL and sample size as well as source kind,
  scope and precision. Axis bounds are explicit; missing dates remain gaps.
- Production Stratus 28d3d728-21b0-47ed-9f31-cb218ec81471: health,
  developer guide, capability API, Bluesky profile and creator-themed graph
  returned 200. Production rate-limit and service bindings work; local opaque
  binding errors did not reproduce. API/widgets are noindex; guide is indexable.
- Existing collector chart update: 9502ae08-c440-4321-a8f2-b78e039c4001.
  Both cron schedules and existing bindings are preserved. Dry runs, generated
  binding types, TypeScript and 50 tests passed before these deployments.
- Supplied/deployed-source logo SHA-256 is identical:
  9826c3a13ec14d8a35d0bc226a5c8519788449f39ba57c538e2b29518183fff3.
- Ten production responsive/axe/interaction checks and a no-JavaScript check
  passed. Creator widgets retain the copper/gold theme and opt-in motion.
- Initial Lighthouse: home 98/100/100/92, docs 100/100/100/92. The SEO deduction
  was a browser CSP fetch violation, not malformed robots content. Allowed only
  same-origin connections so robots and future first-party reads are accessible;
  no external connect origins or unsafe script permissions added.
- Final Stratus e10294df-f52b-4ce4-aa2e-458506b5efd6: homepage
  96/100/100/100; developer guide 100/100/100/100 (mobile lab measurements).
  Remaining homepage suggestions include original-logo transfer size and
  render-blocking CSS; no all-100 performance claim is made. Zero layout shift.
- Real iframe smoke test on the production creator site passed with no page
  exceptions and the copper/gold theme. No mocked service response in this test.

## Offline saved-page parser — 2026-09-08

- User approved a local parser while retaining automatic supported public sources.
  Public policy checks found Instagram/Facebook/X/Reddit crawler restrictions;
  no unattended adapter, hidden endpoint, cookie reader or bypass was enabled.
- Removed only our uncommitted, undeployed paid-provider draft. Its migration
  was never applied; production storage and schedules are unchanged.
- Twelve new tests exercise synthetic profile formats, exact identity, pinned
  YouTube owner ID, private TikTok rejection, counter conflicts, dates, limits,
  unknown values, rounded precision and old-snapshot expiry. A real CLI child
  process with fetch disabled proves default preview is offline; another checks
  owner-only publication rejection. No fixture is a claimed creator statistic.
- An initial source-text assertion incorrectly matched the CLI's explanatory
  output string; replaced it with the actual subprocess behavior check.
- All 43 tests pass. Restricted Wrangler access failed log/compiler resolution;
  the scoped rerun passed generated types, TypeScript and deployment dry run
  (54.43 KiB upload / 16.89 KiB gzip). No parser code enters the Worker bundle.
- No user-saved page or real aggregate publication was available. Live parser
  compatibility and missing platform counts are not claimed as verified.
- First deploy 0b3663f9-9b9a-4a0b-96ed-ef6941aebc9c passed 26 responsive widget
  checks plus search, script embed, reduced-motion and no-JavaScript checks.
  A separate live schema assertion caught old KV snapshots omitting the new X
  following field. Read-time normalization now adds null defaults without
  changing dates, values, source attribution, reports or stored records. Added
  a service/relay regression case for this pre-existing-cache compatibility.
- Follow-up: all 44 tests, generated types, TypeScript and dry run pass. Deployed
  code 24fd9ee as version 6a142544-f73d-4f4d-b8a9-6b50db98eb54. Live X profile,
  creator bundle, site relay and X widget now include following as unknown;
  existing Twitch provenance is retained. Public repository CI passed for both
  implementation commits. No migration, provider payment or real data import.

## Paused provider draft — 2026-09-08

- Started from clean main. Consulted the documented SociaVault one-credit
  profile response contracts; no credentials or raw user payloads were saved.
- Local adapter/model/service/config and migration draft only. Daily allowance
  remains zero. No remote migration, provider run, deployment or spending.
- User redirected work to an Apify review before verification. Build, generated
  types, fixtures, budget concurrency tests, cron routing, source-separated
  history consumers and live validation remain required before release.
- Existing production site and Worker are unchanged. This entry records work
  in progress, not a passing regression result or an enabled connection.

## Keyless Twitch collection

- Preflight: documented DecAPI endpoints returned a resolved owner ID, 25
  followers and an explicit offline reply. Its robots policy allows access.
  The configured YouTube feed returned 404; no replacement source was invented.
- Six new tests cover identity, redirects, HTTP-200 errors, body limits, offline
  zero, partial failure, cache expiry, source labels and creator relay merging.
  All 31 unit tests, generated types and dry run passed before deployment.
- API reads are rate-limited and cached. The five-minute cron only refreshes
  Twitch; the original hourly GitHub/Bluesky and history maintenance remain.
- Deployed version f0bcb17a-3af9-4085-9085-834f2e5b2510. Live lookup, creator
  bundle, capability metadata and D1 follower history returned 200 with attributed
  Twitch counts. All 26 responsive widget cases passed, including Twitch's
  profile, creator-styled cards and history, plus search, no-JS and reduced motion.
- No YouTube/TikTok counter success is claimed.
- General lookup check: /v1/profiles/twitch/twitch returned the official Twitch
  account's resolved numeric ID 12826 and attributed counts. This is separate
  from Sammy's pinned ID. The creator observation advanced from 03:35 to 03:46
  UTC without a site rebuild, confirming independent refresh. Public lookup
  requires no visitor token and does not create permanent arbitrary-user history.

## Creator embed theme follow-up

- Added a presentation-only creator theme; no storage, authorization, collection
  or schema changes. Default output is unchanged apart from optional root class.
- Added a unit comparison protecting identical metric markup and default theme;
  extended the live browser matrix to cover warm graph/carousel/ticker displays.
- All 25 unit tests, generated types and deployment dry run passed. Version
  6e1dcc87-80c9-4be5-b53a-a9c4ea99bc74 deployed with existing bindings/secrets.
  Twenty responsive widget/view combinations passed axe, console and overflow
  checks, plus search, cross-origin embedding, reduced motion and no-JS fallback.
  No new source connection or data import is claimed.

## 2026-09-07 — history, export parsing and visual displays

- Retained separate KV source keys and the existing version-1 creator relay.
- Added nine tests covering local export privacy, CSV edge cases, invalid dates,
  report periods, source merging, real SQL history, deduplication, no invented
  graph trends, reduced-motion controls and authenticated bounded imports.
- The initial history fixture tried to give distinct observations one identical
  primary key; fixed the fixture to age rows while preserving distinct timestamps.
  All 24 tests then passed. Type generation and deployment dry run passed.
- Local Wrangler's runtime rejected the previous future compatibility date.
  Matched the supported 2026-09-04 date. Local D1 commands still returned an
  internal runtime error; direct SQLite schema/query tests pass, and the additive
  migration applied successfully to the new empty remote D1 database.
- Deployed Worker version 45c1da3e-1fa7-40de-84b8-26a9d0492d7a. Live health,
  15-profile legacy-compatible snapshot and D1 history reads returned 200.
- Fourteen responsive page/view combinations passed axe, console and overflow
  checks. Search form, cross-origin script embed, reduced-motion manual controls
  and no-JavaScript card fallback passed; screenshots were visually reviewed.
- Added an explicit header-count bound after review found the final CSV column
  could bypass the delimiter-time bound. Its regression assertion passes.
- The creator kit passed twelve behavior checks. Its local Lighthouse sample
  scored 100 Performance / 100 Accessibility / 96 Best Practices / 100 SEO;
  the static-only preview lacks the Worker API route and logged its fetch error.
- Production creator-kit Lighthouse scored 100 in all four categories (LCP
  1476 ms, TBT 54 ms, CLS 0). Its 26-page browser sweep and 394 HTTP checks passed.
- Public repository CI 34179645114 passed. Creator publisher 34179474042
  successfully wrote aggregates and D1 history; the Instagram history endpoint
  returned a real 2026-09-08T02:16:40.216Z observation. That workflow's separate
  upstream-health step failed on YouTube RSS 404 and retained cached posts.

## 2026-09-07 — initial service

- Risk: public refreshes could replace richer imported counters. Fixed by keeping
  public lookup, serialized full snapshots and owner exports in separate keys,
  then selecting metrics using their own observation dates.
- Risk: private fields or HTML labels in imports. Added field allowlists,
  standardized demographic labels, valid periods/totals and duplicate checks.
- Risk: arbitrary URL proxying. Added exact platform/username validation and
  fixed-host provider URLs; no redirects or scraping adapters.
- First unit run: 15 tests passed. Restricted Windows sandbox prevented Wrangler
  log access/compiler resolution; that is an environment failure, not a successful
  deployment dry run. Re-run with scoped tool access before publishing.
- Re-run type generation, TypeScript and deployment dry run passed; initial
  upload was about 34 KiB (11 KiB gzip), with a measured Worker startup of 14 ms.
- Required-secret protection rejected the first deployment as intended. A
  fail-closed bootstrap allowed secure provisioning. Cloudflare's first subdomain
  activation returned 10007; retry succeeded. Initial secret propagation caused
  one 401; provisioning verification then accepted seven aggregate snapshots.
- Browser testing used the installed Chrome after the optional Playwright browser
  bundle was absent. The first console check found an automatic favicon request
  returning 404; added an explicit empty favicon response before re-testing.
- Final production version c90bf9f2-12a7-4031-9169-721848fdd8b0 uses required
  import-secret configuration and visible-widget refreshes. All 15 unit tests,
  generated types, TypeScript and deployment dry run passed again.
- Live Chrome checks passed eight pages/viewport combinations at 320 and 1440px,
  eight axe scans, console checks and exact-handle form submission. Screenshots
  were visually reviewed; no horizontal overflow or detected violations.
- Public repository CI run 34176399804 passed. Creator workflow 34176494518
  successfully published seven sanitized platform snapshots through the import
  API. Its platform credentials were not transferred to this repository/Worker.
- Cross-origin embed.js integration passed on a controlled 390px host page: the
  lazy iframe loaded all four GitHub fields, its own refresh script and isolated
  styles, with no host overflow. The creator site's 26-route browser sweep and
  394 HTTP/cache checks passed; its media-kit mobile Lighthouse sample was
  100/100/100/100 (1.54 s LCP, 30 ms TBT, CLS 0).
# 2026-09-08 — coverage follow-up

- Baseline: public creator bundle and history APIs return valid observations,
  but daily buckets collapse same-day collection times.
- FxEmbed public profile API returned code 200 for the enrolled X handle.
- Added scheduled, bounded source-labeled X collection and hourly seven-day
  history, preserving source URL/sample-size separation. 68 unit tests pass;
  generated Worker types and TypeScript checks pass; both deployment dry-runs
  pass (the sandbox build needed an approved filesystem escalation).
- Saved the pre-migration public-aggregate backup under ignored .evidence/.
  Applied 0002_source_aware_observations.sql remotely: 236 rows before and after.
  The migration replaces the table structure while preserving its records.
- VPS rootless snapshot service is active and healthy; last success at
  2026-09-08T07:11:50.616Z, ~18.47 MB measured memory, 15-minute cadence.
  It remains private and does not supply missing platform authorization.
- Deployed collector fa66bd34-69eb-41a3-a75a-9fb31c11ff33 and Stratus
  cca1931d-1cb4-4ecf-9be8-f72e85a9f8d3. Production hourly-resolution history
  retained multiple real observations; the real cross-origin creator graph passed.
- At 07:31 UTC the scheduled X collector published all three real public counters
  with FxEmbed attribution and collection dates. No paid X request was made.
- Follow-up moves X to the existing five-minute cadence, rather than collecting
  at the exact ten-minute freshness boundary; a regression locks this schedule.
- All 69 tests, TypeScript and both Worker dry runs passed. Deployed collector
  7e941cad-69ef-4c66-9c82-286a0884202d with both existing cron triggers retained.
  Production creator-site checks confirm current X fields and actual source-aware
  chart rendering; the independent hourly publisher now supplies YouTube totals.
