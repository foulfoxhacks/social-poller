# Supplied X connector starter — 2026-09-08

The user supplied `x-connector.mjs`, `x-connector.test.mjs` and integration notes.
All **23 supplied tests passed independently** under Node, using synthetic
fixtures and mocked fetches. No live FxEmbed collection or paid X call was run.

Useful foundations: string-preserved account IDs, missing-versus-zero values,
rounded-value rejection, application-level error checks, single-request fetches,
source-aware net-change calculations, and publication flags defaulting to false.

Before importing this adapter into a deployed collector:

- Match the returned handle/account identity to the requested enrolled account.
  The starter currently validates handle syntax but does not check that match.
- Bound JSON response bytes; `response.json()` currently has no size limit.
- Enforce collection and publication permissions in trusted server state.
  False fields on a returned object are useful metadata, not authorization.
- Keep the source host operator-configured and allowlisted, never a public
  request parameter. Cancel rejected response bodies and sanitize diagnostics.
- Add tests for identity mismatch, oversize bodies, privacy changes, revocation,
  source switching, unknown source observation times, and stale-cache removal.
- Validate current endpoint availability and the permitted retention/display/
  redistribution terms before turning it into a public Stratus feature.

This release does **not** activate FxEmbed, copy credentials from screenshots,
enable a paid fallback, or claim X statistics are now available. The original
starter remains in the supplied location, unmodified. It is not a dependency of
either deployed Worker. Existing optional owner-saved-page imports remain dated,
owner-supplied snapshots, not live data.
