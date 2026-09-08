# Stratus Social / Social Poller backend

[Stratus Social](https://stratus-social.kc3wca.workers.dev/) is the separately
deployed branded explorer. See its [developer guide](https://stratus-social.kc3wca.workers.dev/docs/)
and [release notes](STRATUS-RELEASE.md). The existing `social-poller` Worker and
repository name remain compatible with creator-site integrations.

Creator-authorized connections are a [staged OAuth foundation](OAUTH-CONNECTIONS.md),
not an enabled login. The [supplied X starter review](X-STARTER-REVIEW.md) documents
why that experimental adapter is not part of the deployed collector yet.

The [VPS operations container](operations/vps/README.md) maintains a private,
seven-day copy of selected already-public metrics on a fifteen-minute schedule.
It does not add platform access or move the working services off Cloudflare.

A separate Cloudflare Worker for exact social-profile lookup, source-labeled
statistics, embeddable cards, and an authenticated creator-metrics relay.
**There is no unattended social-page scraper.** An offline parser can read an
explicitly supplied saved public profile page. No hidden endpoints, login
bypasses, CAPTCHA workarounds, cookie harvesting, or fabricated counters are used.

## What currently works

| Connection | Available data | Update path |
| --- | --- | --- |
| GitHub, any exact username | Followers, following, public repositories; owned-repository stars for accounts with at most 100 public repositories | Public REST API, ten-minute lookup cache |
| Bluesky, any exact handle | Followers, following, posts | Public AppView API, ten-minute lookup cache |
| Sammy's connected Instagram | Followers, following, posts, recent-post sample likes/averages, approved aggregate age/gender/country insights | Existing authenticated hourly collector publishes sanitized aggregates |
| Sammy's connected TikTok | Whatever the granted scopes return; currently recent-video sample averages | Existing authenticated hourly collector |
| Twitch, exact username | Followers and concurrent viewers through DecAPI; Sammy's resolved account ID is pinned | Keyless third-party API, five-minute cache; Sammy refreshed every five minutes |
| YouTube, X | Normalized fields ready; automated data needs their API authorization | Existing collector when configured, or owner export |
| Facebook, Kick, Reddit, LinkedIn | Registered owner metric imports; no automated general lookup yet | Authenticated aggregate export |
| VRChat, Steam, PlayStation, Spotify listener profile | Official profile links only; no configured audience counters | Profile directory |

Twitch counters come from [DecAPI's documented endpoints](https://docs.decapi.me/twitch),
not a Twitch-page scraper. DecAPI uses its own upstream access: no platform key
is required from this Worker, but this is still an external data dependency.
Its [upstream cache](https://docs.decapi.me/cached-endpoints) is two minutes for
followers and five minutes for viewers. Our retrieval timestamp is not proof of
the upstream measurement time. The media kit additionally checks its relay every
five minutes while visible; this is near-live polling, not second-by-second data.
Public counters expire after ten minutes without a successful retrieval. A
provider error is unknown, never zero; only its exact offline reply becomes zero.

The second TikTok profile is listed but not connected. A shared username is not
proof that two accounts belong to the same person. This service does not search
private analytics for arbitrary people. CSV/JSON exports use explicit column
mapping; they do not provide automatic access to every platform or vendor format.

## Saved public pages: no paid provider

For platforms without a working automated connection, save a public profile page
you can ordinarily view as `.html` or `.htm` into the Git-ignored `imports/`
directory. Supply its actual capture time, including the timezone. Do not supply
private account archives, browser profiles, cookies, session exports or messages.
Use the public profile itself, not analytics or settings pages.

```sh
# Preview only: no network request, no upload, no execution of saved scripts.
npm run parse:page -- imports/profile.html tiktok akasammythepuppy ACTUAL_ISO_CAPTURE_TIME
# After checking identity, counter meanings, values and the capture time:
npm run parse:page -- imports/profile.html tiktok akasammythepuppy ACTUAL_ISO_CAPTURE_TIME --publish
```

Replace `ACTUAL_ISO_CAPTURE_TIME` with the time you saved the page, for example an
ISO value shaped like `YYYY-MM-DDTHH:mm:ss-04:00`. Never use today's time for an old
saved file. Publishing uses the existing environment-only
`SOCIAL_POLLER_IMPORT_TOKEN`; do not put it in chat or command arguments.

Recognized, bounded formats (English labels where applicable):

| Platform | Recognized saved content | Aggregate fields |
| --- | --- | --- |
| TikTok | Profile `__UNIVERSAL_DATA_FOR_REHYDRATION__` or `SIGI_STATE` JSON | Followers, following, public videos, received account likes |
| YouTube | Identified channel `ytInitialData`, classic or modern header | Public subscribers (rounded), public videos |
| Instagram | Exact profile canonical/OG URL and labeled description metadata | Followers, following, posts |
| X | Exact profile canonical/OG URL and same-profile labeled links | Followers, following |
| Facebook | **Only if present:** profile-entity JSON-LD with explicit interaction statistics | Followers and Page likes |

These are parser contracts, not guarantees about every current platform layout.
Tests use clearly synthetic fixtures; no real saved page has yet been supplied
for validation. Translated pages, missing embedded data, login/challenge pages,
changed layouts and unsupported formats fail explicitly. Facebook's normal page
may not include the required JSON-LD. Use the CSV/JSON export importer below when
a page lacks recognized counters. Do not repeatedly retry blocked remote pages.

Preview can parse other exact public identities locally; publishing to this
deployment remains restricted to registered owner accounts. Only recognized
counters, identity, precision and the stated date reach the protected API. Raw
HTML and unselected fields stay local. Maximum input: 8 MiB; scripts are parsed
as data, never evaluated. Conflicting identities or counter sources are rejected.

Published results flow through the existing creator relay, cards, tickers and D1
history. They remain **owner-supplied snapshots**, not independently verified or
live measurements. `5.5K` stays rounded, missing values stay unknown, and repeated
imports do not invent growth or reset the capture date. Private impressions,
reach, demographics and historical trends cannot be recovered from a public
profile counter. Use explicit, dated analytics exports for those report fields.

No Apify or SociaVault call, subscription or credit is needed. Our GitHub/Bluesky
public adapters and documented DecAPI Twitch connection continue independently;
the latter is still a third-party dependency. Hosting quotas and operational costs
still exist: no-paid-provider does not mean unlimited free live data.

## API-free export imports

Creator-site widgets can append `&theme=creator` to `/widget` URLs, or use
`data-theme="creator"` with the script embed, for Sammy's copper/gold styling.
This changes presentation only, never which data is collected or returned.

Download your own aggregate analytics report and keep it in the Git-ignored
`imports/` directory. Private account archives, follower lists and messages are
not suitable inputs. Map the report's exact column headings in a local file:

```json
{
  "platform": "youtube",
  "username": "akasammythepuppy",
  "observedAtColumn": "Date",
  "metrics": {"followers": "Subscribers"}
}
```

Use this only if Subscribers is the account total, not subscribers gained in a
period. Dates must be ISO timestamps with a timezone, or YYYY-MM-DD (midnight
UTC). Missing values remain unknown; abbreviated 5.5K-style counts are rounded.

```sh
npm run import:export -- imports/report.csv imports/mapping.json
# Review the sanitized preview before publishing publicly:
npm run import:export -- imports/report.csv imports/mapping.json --publish
```

No platform API key is needed. Publishing requires SOCIAL_POLLER_IMPORT_TOKEN
supplied securely in the environment, never a command argument or public browser.
The CLI accepts the verified service origin only and sends at most ten sanitized
observations per request. Only selected counts and dates are uploaded; raw files
and unselected columns stay local. Serialize imports for the same profile.

JSON input is a flat array of rows with the same mapping. Limits: 256 KiB, 366
rows, 100 CSV columns. Only registered owner accounts can publish. No formulas
are evaluated. No export has yet supplied the missing platform counts.

Reporting fields: periodViews, reach, impressions, engagements, watchSeconds,
linkClicks, shares, saves. They require a period object containing ISO start/end
or startColumn/endColumn. End must precede the observation date. A fixed observedAt
can replace observedAtColumn. multipliers: {"watchSeconds": 3600} converts hours;
60 converts minutes. Never map period views into lifetime views. Report periods
remain separate measurement scopes and do not contribute to follower totals.

YouTube documents [analytics exports](https://support.google.com/youtube/answer/9717005).
TikTok documents [Business Suite analytics exports](https://ads.tiktok.com/help/article/navigate-web-business-suite?lang=en).
Availability depends on the account and platform. An export parser still needs
owner-provided downloads; it cannot continuously fetch inaccessible private data.

## Graphs, rotating cards and tickers

Add view=cards, graph, carousel or ticker to a profile URL or /widget. Graphs accept
metric=followers (or another supported field) and days=7, 30, 90 or 365. Script
embeds accept data-view and data-metric. The history JSON route is
/v1/history/{platform}/{username}?metric=followers&days=30.

D1 records registered owners' actual observations, deduplicated by identity,
metric, date, scope and source; the first value at an identical key is retained.
History queries return the last daily point per scope/source/precision. Missing
days are not interpolated, unlike scopes never share a series, and gaps over two
days break lines. Accessible tables contain the recorded values. One point is not
a growth trend. Retention is 400 days; earlier history is never manufactured.
Arbitrary user searches do not create permanent analytics tracking records.

Playback is opt-in with previous/next/pause controls. Reduced motion disables
autoplay and hidden tabs stop it. Without JS all cards remain readable. No chart
framework or platform script is loaded. The creator site loads displays on request.

## API and widgets

### Other creators can use this backend

The read-only lookup and widget routes are not limited to Sammy. Twitch, GitHub
and Bluesky accept any valid exact public username/handle. For example:

```text
GET SERVICE/v1/profiles/twitch/twitch
GET SERVICE/v1/search?platform=twitch&username=twitch
GET SERVICE/widget?platform=twitch&username=twitch&view=ticker
```

No visitor API key or platform login is required for these public reads. Results
are cached and rate-limited; this is not unlimited or instantaneous collection.
Twitch lookups refresh on demand after five minutes, and visible widgets check
again every five minutes. Only registered owner profiles receive background
collection and permanent history. Arbitrary searches do not enroll someone in
tracking. Other platforms' missing fields remain unavailable, not estimated.

The backend presents a common schema; it does not remove upstream dependencies.
Private insights and owner imports are not a public multi-tenant authorization
system. Adding creator enrollment, private analytics, or additional providers
requires explicit ownership/consent, credential isolation and quota controls.

Live service: https://social-poller.kc3wca.workers.dev . Replace `SERVICE` below
with that origin (or your own deployed Worker origin).

```text
GET SERVICE/?platform=github&username=foulfoxhacks
GET SERVICE/v1/search?platform=bluesky&username=akasammythepuppy.me
GET SERVICE/v1/profiles/github/foulfoxhacks
GET SERVICE/v1/history/github/foulfoxhacks?metric=followers&days=30
GET SERVICE/v1/platforms
GET SERVICE/v1/creators/akasammythepuppy
GET SERVICE/v1/media-kit/akasammythepuppy
GET SERVICE/openapi.json
GET SERVICE/health
```

Search requires one platform and an exact username, not an arbitrary URL. API
reads support CORS. The UI renders its content on the server. Embed an isolated,
lazy-loaded iframe, or use the optional small iframe loader:

```html
<iframe src="SERVICE/widget?platform=github&username=foulfoxhacks"
  title="GitHub statistics for foulfoxhacks" loading="lazy"
  width="100%" height="560" style="border:0"></iframe>

<div data-social-poller data-platform="github" data-username="foulfoxhacks"></div>
<script src="SERVICE/embed.js" defer></script>
```

The iframe has its own scroll area when needed and reloads every five minutes
while visible. The creator media kit checks its same-origin relay on that same
cadence. This is scheduled/cached reporting, not a real-time event stream.

## Authorized publisher

`POST /v1/import/media-kit` accepts the creator site's version-1 aggregate
snapshot. It requires `Authorization: Bearer <IMPORT_TOKEN>` and JSON, capped at
64 KiB. Only approved fields are stored: no tokens, follower lists, email
addresses, city data, raw platform payloads, or free-text demographic labels.
The existing collector retains platform credentials; this Worker never receives
them. Configure a single serialized publisher (the site's existing Actions
concurrency group) for full snapshots.

`POST /v1/import/profile` accepts explicitly registered owner aggregates:

```json
{
  "platform": "facebook",
  "username": "akasammythepuppy",
  "observedAt": "<actual ISO observation date>",
  "metrics": {"followers": 123},
  "precision": {"followers": "exact"}
}
```

The value above is an example, **not Sammy's statistic**. Use `rounded` when the
platform only shows an abbreviated counter. Averages are always labeled as
samples. Unsupported keys, negative/nonfinite counts, future dates, and
unregistered identities are rejected. Manual exports remain owner-reported,
not independently API-verified. Never put the import token in a browser widget.

## Data semantics and failure handling

- Every metric retains `value`, `observedAt`, `current`, `precision`, `scope`,
  source kind/URL, and sample size when available.
- Unknown values are `null`, never zero. Followers, likes, views, stars and karma
  are not interchangeable. Follower sums do not represent unique people.
- A failed refresh preserves dated values and marks that source stale. A separate
  source can retain its own newer observation. Six-hour-old metrics are stale.
- Full published snapshots, owner exports, and public lookups use separate KV
  namespaces so public refreshes cannot overwrite richer imported analytics.
- KV is eventually consistent; allow at least a minute for propagation. This is
  not a multi-writer transaction system. Serialize exports for each profile too.
- An additional five-minute cron refreshes Sammy's Twitch counters. The hourly
  cron refreshes registered GitHub/Bluesky handles. The site's hourly
  collector independently publishes its other authorized data.
- Reads are limited to 60/minute per IP; provider refreshes share a 10/minute
  budget per Cloudflare location. These are approximate per-location controls,
  not global billing caps. Upstream quotas still apply. There is no paid proxy.
- APIs and utility search pages are intentionally noindex. This does not change
  the creator website's canonical index/follow pages.

## Develop and deploy

Node 24 is recommended. Work on `main`; keep secrets and runtime state out of Git.

```sh
npm ci
npm test
npm run check
npm run build
npx wrangler kv namespace create SNAPSHOTS
npx wrangler d1 create social-poller-history
# Set your own D1 database ID in wrangler.jsonc before applying its schema:
npx wrangler d1 migrations apply social-poller-history --remote
# Put the returned namespace ID in wrangler.jsonc for your deployment.
# For a new Worker, deploy once with the required-secrets declaration omitted;
# imports fail closed until you set IMPORT_TOKEN. Then restore that declaration.
npx wrangler secret put IMPORT_TOKEN
npm run deploy
```

Use a fresh random token of at least 32 characters and configure the same value
as `SOCIAL_POLLER_IMPORT_TOKEN` in the creator repository's Actions secrets.
Never copy another deployment's KV ID or credentials. The creator Worker uses
the `SOCIAL_POLLER` service binding, with its original public JSON as a fallback.
No platform API request is added to the site's rendering path.

CI validates tests, generated Worker types, and the deployment dry run. Deployment
is intentionally operator-controlled; no Cloudflare credential is checked in.
See [CHANGELOG](CHANGELOG.md), [REGRESSION-LOG](REGRESSION-LOG.md), and
[SECURITY](SECURITY.md). No open-source license grant has been selected yet;
public repository visibility alone is not an open-source license.

## Primary references

- [Bluesky public profile API](https://docs.bsky.app/docs/api/app-bsky-actor-get-profile)
- [GitHub user API](https://docs.github.com/en/rest/users/users#get-a-user)
- [Cloudflare service bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Cloudflare KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- [Native request limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
