# Changelog

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
