# Creator-authorized OAuth connections — staged foundation

Status: **storage/state primitives implemented and tested; not a live login**.
No production connection database or OAuth routes are enabled in this release.
The public explorer remains a read-only beta. No screenshot credential is used.

## The product model

1. Sign into Stratus through a verified identity/session layer.
2. Choose Connect Twitch, review requested read access, and select a 1-, 7- or
   30-day connection hold period (UI default should be seven days).
3. Use a server-side authorization-code exchange, not tokens in browser URLs.
4. Store encrypted tokens in a private, tenant-scoped connection database.
5. Start private. Separately opt into publishing specific aggregate metrics.
6. Enforce the earlier of the chosen hold deadline and provider requirements.
   Token expiry, analytics retention and public-sharing consent are distinct.
7. Disconnect immediately removes the local grant and associated metric rows;
   attempt provider revocation too. Purge expiry on a scheduled job. Provider
   backups/recovery windows must be disclosed before promising physical erasure.

Creators authorize access; they do not hand over ownership of their data or
grant unlimited storage/redistribution. OAuth is not a paid-API or policy bypass.
An equivalent mechanism does not imply every platform exposes Spotify-like data.

## Implemented here

- `src/connection-vault.ts`: AES-256-GCM with random nonces and tenant/provider/
  account authenticated encryption context; private-by-default storage; bounded
  hold periods; tenant-qualified queries; publication field allowlist; logical
  expiry checks, cascade deletion and purge primitives.
- OAuth state is random, hashed at rest, browser-bound, expires after ten
  minutes, and is consumed atomically with `DELETE ... RETURNING`.
- Reads refuse tokens after their access expiry or one hour without validation.
- Separate `connections/migrations/` avoids changing the public history DB.

## Required before enabling sign-in

- Rotate the exposed Twitch secret and securely install the replacement plus
  a new 32-byte encryption key in Worker secrets. Never paste them in chat/Git.
- Verify the application's exact HTTPS callback URI in the provider portal.
- Implement verified Stratus sessions (Secure/HttpOnly cookies), CSRF/origin
  checks, browser state-cookie lifecycle, and account-link ownership checks.
  A tenant ID supplied in a public query/body is never proof of authorization.
- Wire the authorization-code exchange, identity/client/scope validation, token
  refresh serialization and hourly validation. The vault itself does not fetch
  or refresh tokens and cannot replace those handlers.
- Apply this schema to a separate private D1 binding. Add quota-controlled jobs,
  retention cleanup, revocation, deletion/cache invalidation and private metrics
  routes. Public routes may select only explicitly approved aggregate fields.
- Complete genuine end-to-end consent, denied-consent, expiry, refresh and
  disconnect tests with rotated credentials. Add appropriate privacy/deletion
  notices before collecting other creators' data.

Primary implementation references, checked 2026-09-08:
[Twitch authorization-code flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow),
[token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/),
[revocation](https://dev.twitch.tv/docs/authentication/revoke-tokens/).

YouTube, TikTok, Meta and other providers need independent permission, scope,
retention and publication adapters. Do not extend Twitch's rules globally.
