# Stratus VPS operations worker

An ancillary rootless Podman container, deployed on the owner-provided Ubuntu
VPS. Cloudflare remains the production website, public API and source collector.
This container does **not** scrape platforms, bypass blocks, collect new accounts,
store OAuth tokens, or replace the unfinished connection flow.

## Work performed

- Reads the fixed, already-public Sammy creator bundle once on startup and then
  every fifteen minutes after the previous attempt completes. No visitor request
  initiates a collection. At most 96 scheduled requests/day, plus restarts.
- Keeps only allowlisted numeric Instagram, TikTok, Twitch, Bluesky and GitHub
  fields with source, precision, scope and original observation dates. Unknown,
  stale and invalid values are omitted, not zeroed. No posts, follower identities,
  demographics, raw provider responses, or YouTube observations are archived here.
- Stores one private JSON file per fifteen-minute slot plus `latest.json` in
  `/opt/stratus-social/state`. Purges copies seven days after their capture on
  each attempt, including failed collection attempts. Cleanup resumes on startup
  after downtime; this is not guaranteed erasure while the VPS is stopped.
- A 401/403/404/410 from the publisher clears these snapshot files. Other failures
  retain bounded history privately but return 503 for `/latest`. This operational
  cache is not an independently authorized redistribution or historical-data API.
- `/health` reports job health, **not** source freshness. `/latest` includes
  original provider timestamps and the separate capture timestamp. The service
  is loopback-only at `127.0.0.1:9081`; neither endpoint is publicly routed.

Fetches refuse redirects, have a twelve-second timeout and a 512 KiB response
limit. Input has no URL override. Logs contain status codes, not payloads. The
runtime has no dependency installation, browser, provider keys or paid fallback.

## Installed footprint

- Ubuntu packages: Podman, uidmap, slirp4netns, fuse-overlayfs and their twelve
  total package dependencies. No pre-existing package was upgraded or removed.
- Dedicated locked-password, non-login user `stratus-runtime`, with subordinate
  UID/GID ranges and systemd lingering for operation after SSH logout.
- New root-owned release files in `/opt/stratus-social/releases/2026-09-08.1/`;
  the first validation build remains available in the preceding release directory.
- Owner-only state directory; rootless container image storage in the service
  user's home; Quadlet in `/etc/containers/systemd/users/1000/` on this host.
- Container UID/GID 1000, read-only root filesystem, no capabilities, no new
  privileges, 16 MiB temporary filesystem, 64-process limit, 192 MiB memory cap,
  no extra swap, 0.25 CPU, and bounded 1 MiB container logs.
- The rootful Podman service/socket and auto-update timer installed by the
  package were disabled. No automatic image updates; no firewall/DNS/SSH changes.

The Containerfile pins the official Node 24 Alpine image by digest. Review and
test an updated digest explicitly before a future release; the tag is not used
at container startup. Infrastructure and any future provider usage still have
finite limits. This is not a promise of unlimited free collection.

## Tests and maintenance

Run `node --test tests/vps-snapshot.test.ts` from the repository. Full verification
is included in `npm test`. The deployed release passed a real collection and
service restart check; the host was not rebooted for this test.

From an authorized root SSH session, use the service user's actual UID:

```sh
cd /opt/stratus-social
stratus_uid=$(id -u stratus-runtime)
runuser -u stratus-runtime -- env XDG_RUNTIME_DIR=/run/user/$stratus_uid \
  DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$stratus_uid/bus \
  systemctl --user status stratus-snapshot.service --no-pager
curl --max-time 5 -fsS http://127.0.0.1:9081/health
```

To inspect the local endpoint from a workstation, open an authorized SSH tunnel
to your own VPS using `ssh -L 9081:127.0.0.1:9081 USER@YOUR_VPS`, then visit
`http://127.0.0.1:9081/health`. Do not expose the port publicly.

To stop this service, use the same `runuser ... systemctl --user` command with
`stop stratus-snapshot.service`. For a persistent stop, rename this specific
Quadlet file to `stratus-snapshot.container.disabled`, then daemon-reload. State
remains recoverable; no deletion is necessary. Future updates should use a new
release directory/image tag, retain the previous release and validate health
before discarding anything. The creator website is unaffected by a VPS rollback.

See [Podman 4.9 Quadlet documentation](https://docs.podman.io/en/v4.9.3/markdown/podman-systemd.unit.5.html)
for user-unit paths, restart and boot behavior. OAuth's hold periods and consent
are separate from this operations cache: see [OAUTH-CONNECTIONS.md](../../OAUTH-CONNECTIONS.md).
