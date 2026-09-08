# Regression log

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
