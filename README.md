# Social Poller

A separate Cloudflare Worker for exact social-profile lookup, source-labeled
statistics, embeddable cards, and an authenticated creator-metrics relay.
**There is no social-page scraper.** No hidden endpoints, login bypasses, CAPTCHA
workarounds, cookie harvesting, or fabricated counters are used.

## What currently works

| Connection | Available data | Update path |
| --- | --- | --- |
| GitHub, any exact username | Followers, following, public repositories; owned-repository stars for accounts with at most 100 public repositories | Public REST API, ten-minute lookup cache |
| Bluesky, any exact handle | Followers, following, posts | Public AppView API, ten-minute lookup cache |
| Sammy's connected Instagram | Followers, following, posts, recent-post sample likes/averages, approved aggregate age/gender/country insights | Existing authenticated hourly collector publishes sanitized aggregates |
| Sammy's connected TikTok | Whatever the granted scopes return; currently recent-video sample averages | Existing authenticated hourly collector |
| Sammy's Twitch | Live viewers with app authorization; followers need an authorized user token | Existing authenticated hourly collector |
| YouTube, X | Normalized fields ready; automated data needs their API authorization | Existing collector when configured, or owner export |
| Facebook, Kick, Reddit, LinkedIn | Registered owner metric imports; no automated general lookup yet | Authenticated aggregate export |
| VRChat, Steam, PlayStation, Spotify listener profile | Official profile links only; no configured audience counters | Profile directory |

The second TikTok profile is listed but not connected. A shared username is not
proof that two accounts belong to the same person. This service does not search
private analytics for arbitrary people. CSV/JSON exports use explicit column
mapping; they do not provide automatic access to every platform or vendor format.

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
- The hourly cron refreshes registered GitHub/Bluesky handles. The site's hourly
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
