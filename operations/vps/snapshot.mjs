// Private operations cache of one already-public Stratus creator bundle.
// No provider credentials, arbitrary URLs, HTML, follower lists or OAuth grants.
import {mkdir, readFile, readdir, rename, unlink, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

export const SOURCE = 'https://social-poller.kc3wca.workers.dev/v1/media-kit/akasammythepuppy';
export const INTERVAL_MS = 15 * 60 * 1000;
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_BYTES = 512 * 1024;
const MAX_FILES = 673;
const FILE = /^snapshot-(\d{13})\.json$/;
const FIELDS = {
  instagram: ['followers', 'following', 'posts', 'averageLikes', 'averageComments', 'sampleLikes'],
  tiktok: ['followers', 'following', 'likes', 'videos', 'averageViews', 'averageLikes', 'averageComments'],
  twitch: ['followers', 'viewers'],
  bluesky: ['followers', 'following', 'posts'],
  github: ['followers', 'following', 'repositories', 'stars'],
};
const KINDS = new Set(['authorized_api', 'public_api', 'public_page', 'owner_export', 'third_party_api']);
const PRECISIONS = new Set(['exact', 'rounded', 'sample', 'estimated']);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const date = (value, now) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now + 60000 ? value : null;

export function normalize(bundle, now = Date.now()) {
  if (!isObject(bundle) || bundle.version !== 1 || !isObject(bundle.platforms) || !date(bundle.generatedAt, now)) throw Error('invalid_snapshot');
  const platforms = {};
  for (const [platform, fields] of Object.entries(FIELDS)) {
    const source = bundle.platforms[platform];
    if (!isObject(source) || !isObject(source.metrics)) continue;
    const metrics = {};
    for (const name of fields) {
      const metric = source.metrics[name];
      if (!isObject(metric) || metric.value === null || metric.current !== true) continue;
      if (typeof metric.value !== 'number' || !Number.isFinite(metric.value) || metric.value < 0 || metric.value > Number.MAX_SAFE_INTEGER) continue;
      const sampledAt = date(metric.sampledAt, now);
      if (!sampledAt || now - Date.parse(sampledAt) >= RETENTION_MS) continue;
      if (!isObject(metric.source) || !KINDS.has(metric.source.kind) || !PRECISIONS.has(metric.precision)) continue;
      if (typeof metric.scope !== 'string' || metric.scope.length > 200) continue;
      let sourceUrl;
      try {
        const url = new URL(metric.source.url);
        if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.href.length > 500) continue;
        // Preserve known public identity parameters without retaining token-like
        // query strings. These attribution URLs are never fetched by this job.
        if (url.search) {
          const publicBluesky = url.hostname === 'public.api.bsky.app' && url.pathname === '/xrpc/app.bsky.actor.getProfile' && url.searchParams.size === 1 && url.searchParams.get('actor') === 'akasammythepuppy.me';
          const publicTwitch = url.hostname === 'decapi.me' && /^\/twitch\/(followcount|viewercount)\/1453387258$/.test(url.pathname) && url.search === '?id=true';
          if (!publicBluesky && !publicTwitch) continue;
        }
        sourceUrl = url.href;
      } catch {continue;}
      metrics[name] = {value: metric.value, sampledAt, precision: metric.precision, scope: metric.scope, source: {kind: metric.source.kind, url: sourceUrl}};
      if (Number.isSafeInteger(metric.sampleSize) && metric.sampleSize > 0 && metric.sampleSize <= 10000) metrics[name].sampleSize = metric.sampleSize;
    }
    platforms[platform] = {metrics};
  }
  // Unknown remains absent. Empty snapshots still replace obsolete cached values.
  return {version: 1, source: SOURCE, capturedAt: new Date(now).toISOString(), providerGeneratedAt: bundle.generatedAt, platforms};
}

export async function fetchSnapshot(fetcher = fetch, now) {
  const response = await fetcher(SOURCE, {redirect: 'error', signal: AbortSignal.timeout(12000), headers: {accept: 'application/json', 'user-agent': 'StratusSnapshot/1.0 (+https://stratus-social.kc3wca.workers.dev/docs/)'}});
  if (!response.ok) {
    await response.body?.cancel();
    throw Error([401, 403, 404, 410].includes(response.status) ? 'publication_unavailable' : 'upstream_unavailable');
  }
  if (!response.headers.get('content-type')?.includes('application/json') || Number(response.headers.get('content-length')) > MAX_BYTES || !response.body) {
    await response.body?.cancel();
    throw Error('invalid_response');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw Error('response_too_large');
      chunks.push(value);
    }
  } finally {await reader.cancel(); reader.releaseLock();}
  return normalize(JSON.parse(Buffer.concat(chunks).toString('utf8')), now ?? Date.now());
}

export async function prune(directory, now = Date.now(), all = false) {
  await mkdir(directory, {recursive: true, mode: 0o700});
  const files = (await readdir(directory)).filter(name => FILE.test(name)).sort();
  const excess = Math.max(0, files.length - MAX_FILES);
  for (const [index, name] of files.entries()) {
    if (all || now - Number(FILE.exec(name)[1]) >= RETENTION_MS || index < excess) await unlink(join(directory, name));
  }
  // latest is not a retention loophole during a prolonged outage or stopped job.
  const latestPath = join(directory, 'latest.json');
  try {
    const latest = JSON.parse(await readFile(latestPath, 'utf8'));
    if (all || !date(latest.capturedAt, now) || now - Date.parse(latest.capturedAt) >= RETENTION_MS) await unlink(latestPath);
  } catch (error) {if (error.code !== 'ENOENT') throw error;}
}

export async function save(directory, snapshot, now = Date.now()) {
  await prune(directory, now);
  // At most one operations snapshot per fifteen-minute slot, even after restarts.
  const slot = Math.floor(now / INTERVAL_MS) * INTERVAL_MS;
  const json = JSON.stringify(snapshot) + '\n';
  if (Buffer.byteLength(json) > MAX_BYTES) throw Error('snapshot_too_large');
  const temp = join(directory, 'pending.json');
  await writeFile(temp, json, {mode: 0o600});
  await rename(temp, join(directory, `snapshot-${slot}.json`));
  await writeFile(temp, json, {mode: 0o600});
  await rename(temp, join(directory, 'latest.json'));
}

export function responseFor(method, path, state, now = Date.now()) {
  if (!['GET', 'HEAD'].includes(method)) return {status: 405, body: {error: 'method_not_allowed'}};
  const healthy = state.lastAttemptOK && state.lastSuccess !== null && now - state.lastSuccess < INTERVAL_MS * 2;
  if (path === '/health') return {status: healthy ? 200 : 503, body: {service: 'stratus-snapshot', status: healthy ? 'ok' : 'unavailable', lastAttemptAt: state.lastAttempt === null ? null : new Date(state.lastAttempt).toISOString(), lastSuccessAt: state.lastSuccess === null ? null : new Date(state.lastSuccess).toISOString(), intervalSeconds: INTERVAL_MS / 1000, retentionDays: 7, error: state.error}};
  if (path === '/latest') return healthy && state.latest ? {status: 200, body: state.latest} : {status: 503, body: {error: 'snapshot_unavailable'}};
  return {status: 404, body: {error: 'not_found'}};
}
