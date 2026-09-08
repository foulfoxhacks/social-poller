# Stratus Social public beta

Separate `stratus-social` Worker, backed by the existing `social-poller` service
binding. No duplicate scheduled collectors, database migration, provider secrets,
private account enrollment, or paid API fallback is introduced.

The supplied Stratus logo is preserved byte-for-byte on a white brand panel.
Public routes: `/`, `/docs/`, `/status/`. Profile queries and widget/API routes
are noindex. Existing Social Poller URLs and creator-site binding are unchanged.
YouTube redistribution is disabled in Stratus pending its own policy review.

Commands: `npm run check`, `npm test`, `npm run build`,
`npm run build:stratus`, `npm run deploy:stratus`.

Deployment verification and remaining connection limitations are recorded in
REGRESSION-LOG.md. Do not interpret the beta as finished multi-tenant analytics.
