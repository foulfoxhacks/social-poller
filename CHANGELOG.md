# Changelog

## Coverage and short-range charts — 2026-09-08

- Added bounded, scheduled FxEmbed public X counts for the explicitly enrolled
  creator only. No X login cookies, paid fallback or arbitrary-profile collection.
  Sources and observation dates remain visible; no private analytics are inferred.
- Seven-day history uses hourly observations; longer ranges keep daily readings.
  SQL grouping now preserves source URLs and sample sizes as separate series.
- A data-preserving migration widens observation identity to stop simultaneous
  source/precision/sample readings from incorrectly deduplicating one another.
- YouTube history is capped at thirty days, with read-time expiry as well as
  scheduled deletion. The new Stratus public YouTube surface remains disabled.
- Chart defaults and rotating displays prefer metrics with actual observations.
- Regression results are recorded in REGRESSION-LOG.md as validation completes.

## Stratus Social beta — 2026-09-08

- Added an isolated rootless VPS snapshot container: fixed public source,
  fifteen-minute cadence, seven-day bounded private storage, local-only health,
  resource limits and systemd restart/boot configuration. Existing Cloudflare
  site, collectors and schedules remain unchanged. No platform tokens involved.
- Extended CI to dry-run both Worker entrypoints as well as the full test suite.
- Added a separate read-only Stratus Worker with the supplied original logo,
  profile explorer, source-aware displays, connection matrix and API guide.
- Reuses the collector through a fixed public-route service binding; no new
  provider tokens, paid calls, write access or duplicate polling schedules.
- Public informational routes are indexable; queries, APIs and embeds are not.
  YouTube redistribution is disabled in this new surface pending policy review.
- Validation and deployment results are tracked in REGRESSION-LOG.md.
- Shared history charts now label their axis range and first/latest observations,
  and separate source URLs and sample sizes. Missing dates remain gaps.
- Reviewed the supplied X starter (23 passing tests); it is not enabled for
  collection or redistribution. See X-STARTER-REVIEW.md for integration gaps.
- Began the requested OAuth model as a staged private connection vault: encrypted
  tenant-bound grants, hashed one-time browser state, explicit 1/7/30-day hold
  choices, private-by-default sharing, expiry gates and cascade deletion.
  No connection DB migration or login/token handler is enabled in production;
  OAUTH-CONNECTIONS.md records the remaining session, exchange and lifecycle work.

## 0.2.0 follow-up — offline public-profile parser (2026-09-08)

- Added a preview-first local HTML parser for explicitly supplied public profile
  pages, with recognized TikTok, YouTube, Instagram, X and conditional Facebook
  JSON-LD formats. This is not an unattended scraper or a live-data connector.
- Enforced exact profile identity, explicit capture dates, bounded input,
  aggregate field allowlists and conflict rejection. Saved scripts never run;
  raw HTML, private fields, browser cookies and sessions are never uploaded.
- Added explicit owner-only publication through the existing import endpoint.
  Rounded counts retain precision and dated owner-export provenance in the
  media-kit relay and history. Added X following as a supported counter.
- Normalized older cached profiles with unknown defaults for newly supported
  fields, preserving original observations and imported reporting fields.
- Removed the undeployed SociaVault adapter and unapplied migration draft below
  after the owner selected a no-paid-provider route. No paid call, migration,
  provider secret or schedule was activated.
- All 44 unit/CLI tests, generated types, TypeScript and deployment dry run pass.
  Parser coverage uses synthetic fixtures; real saved-page validation is pending
  owner input. No missing creator counts have been filled or fabricated.
- Deployed the field compatibility update and verified public profiles, widgets
  and both creator relays; recorded successful CI and live regression results.

## Unreleased draft — provider evaluation (2026-09-08)

- Began a disabled SociaVault public-profile adapter for TikTok, YouTube, X and
  Facebook, with identity checks, bounded responses and aggregate-only output.
- Drafted D1 global daily request reservations, per-profile refresh leases and
  an additive source-separated observation table; no migration has been applied.
- Drafted independent lookup merging, SociaVault source expiry and X following
  counts. Default daily allowance is zero; no provider request has been made.
- Implementation paused at the user's request to compare Apify pricing and
  integration. The adapter, schedule, history consumers and tests are not yet
  release-ready. Nothing in this draft is deployed or claimed as live coverage.

## 0.2.0 follow-up — keyless Twitch counters

- Added a documented DecAPI adapter for public follower and concurrent-viewer
  counts, available through the existing profile API, creator relay and widgets.
- Resolved numeric identities, pinned Sammy's ID, bounded responses and strict
  counter parsing prevent error pages and another account from becoming metrics.
- Added a five-minute Twitch schedule/cache and ten-minute source expiry.
  Source labels identify third-party cached data; no instantaneous-data promise.
- Same-source failures retain dated stale values; existing authorized imports
  stay independent. No new secrets, browser sessions or platform bypasses.
- YouTube/TikTok totals remain unavailable: no unverified alternative was enabled.
  Thirty-one unit tests, generated types and deployment dry run passed.
- Deployed and verified the profile API, creator bundle and persisted follower
  history. Twenty-six responsive widget/browser cases passed.
- Verified a second public Twitch identity through the same backend and added
  reusable lookup/widget examples. Clarified on-demand public refresh versus
  registered-owner schedules/history; no new platform coverage is implied.

## 0.2.0 follow-up — creator embed design

- Added an opt-in `theme=creator` widget style matching Sammy's copper/gold
  palette, square panels and existing font stack. Default service pages keep
  their own theme. Script embeds accept `data-theme="creator"`.
- Theme selection is allowlisted; no custom CSS or URLs are accepted. Metrics,
  collection, histories, freshness and API payloads are unchanged.

## 0.2.0 — 2026-09-07

- Added API-free, local CSV/JSON export parsing with explicit column mapping,
  quoted-cell support, rounded-count precision and strict dates. Only selected
  aggregates reach the protected ten-observation batch endpoint; raw exports
  and unselected private columns remain local.
- Added reporting-period views, reach, impressions, interactions, watch seconds,
  clicks, shares and saves. Explicit period boundaries prevent monthly counts
  from being labeled as lifetime account totals.
- Added a separate D1 history database with idempotent observation keys,
  registered-owner-only history, bounded date ranges and 400-day retention.
  Charts use actual observations, separated by scope, precision and source.
- Added server-rendered SVG history graphs with accessible data tables,
  rotating cards and compact tickers. Playback is opt-in, keyboard controlled,
  pauses in hidden tabs and respects reduced-motion settings. No chart library.
- Added display/metric controls and matching iframe/script embed parameters;
  extended the public API schema and creator snapshot to all registered profiles.
- Matched the compatibility date to the installed runtime's supported 2026-09-04
  date; retained existing KV, scheduled collectors and import credentials.
- Expanded the creator media kit with profile breakdowns, reporting coverage,
  export-ready Facebook/Kick/LinkedIn/Reddit panels and on-demand visual displays.
  Reddit karma remains separate from follower/subscriber audience totals.
- Recorded successful production publishing/history writes, 14 responsive
  widget checks and the integrated media kit's four 100-point Lighthouse scores.
  The separate YouTube RSS failure is documented without discarding cached posts.

This release does not scrape restricted platforms or claim complete coverage.
Non-API updates need owner-exported data; scheduled connections remain available.

## 0.1.0 — 2026-09-07

- Added an independent Cloudflare Worker, public profile search UI, normalized
  JSON reads, creator bundle, and lazy iframe / optional script widgets.
- Added bounded, identity-checked GitHub and Bluesky public API adapters.
- Added authenticated aggregate snapshot and registered-owner JSON imports,
  without moving platform credentials or scraping social pages.
- Preserved unavailable values, provenance, observation dates, sample scopes,
  rounded counters, stale fallbacks, and approved aggregate demographics.
- Isolated public lookup, full publisher and owner-export storage; rejected older
  full snapshots and batched source reads to avoid sequential KV latency.
- Added hourly public refreshes, native request budgets, CORS for reads only,
  input/payload validation, timing-safe bearer checks, CSP and security headers.
- Added regression tests, type generation/checking, dry-run validation and CI.
- Added visible-widget refreshes every five minutes with a first-party script;
  no external analytics, chart library or platform embed is loaded.
- Prepared creator-site service-binding integration with a static JSON fallback.

Deployment and browser verification are recorded in REGRESSION-LOG.md after
they run. This release does not promise every platform exposes every metric.
