# Regression log

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
  Production Lighthouse and full publisher/history integration remain pending.

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
