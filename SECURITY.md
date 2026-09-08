# Security and privacy

Only sanitized, intentionally public aggregates belong in this service. Do not
submit raw analytics exports containing personal records. Public reads expose
all stored approved owner statistics, including approved aggregate demographics.

Private analytics imports require a server-side bearer secret. Rotate the Worker
`IMPORT_TOKEN` and site Actions `SOCIAL_POLLER_IMPORT_TOKEN` together. A missing
or short secret fails closed. No cookies or analytics SDKs are used by the UI.

Inputs cannot select upstream URLs. Providers have fixed hosts, six-second
deadlines, response byte limits, no redirect following and identity checks.
Output uses HTML escaping and a restrictive CSP. Import authorization is checked
before payload parsing; unsupported fields never reach storage. Native request
limits reduce abuse but are not a global quota or cost guarantee.

Report a vulnerability privately using the contact listed at
https://akasammythepuppy.me/.well-known/security.txt. Do not disclose secrets in a
public issue. Runtime logs must contain operational event names and counts only,
not credentials, IP addresses or imported private payloads.
