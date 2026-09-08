# Regression log

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
