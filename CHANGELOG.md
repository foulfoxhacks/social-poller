# Changelog

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
