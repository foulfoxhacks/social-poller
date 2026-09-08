import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readdir, rm, writeFile, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// @ts-expect-error Standalone dependency-free Node operations module.
import {normalize, fetchSnapshot, prune, save, responseFor, RETENTION_MS, INTERVAL_MS, MAX_BYTES, SOURCE} from '../operations/vps/snapshot.mjs';

const now = Date.parse('2026-09-08T06:00:00Z');
function metric(value: unknown = 83) {return {value, current: true, sampledAt: new Date(now - 1000).toISOString(), precision: 'exact', scope: 'account total at observation', source: {kind: 'public_api', url: 'https://public.api.bsky.app/'}};}
function bundle() {return {version: 1, generatedAt: new Date(now).toISOString(), platforms: {bluesky: {metrics: {followers: metric(), following: metric(0), posts: metric(null)}}}};}
test('VPS snapshot preserves zero, source and dates; excludes unknown/private/unapproved fields', () => {
  const input: any = bundle();
  input.platforms.youtube = {metrics: {followers: metric(500)}};
  input.platforms.bluesky.demographics = {private: true};
  input.platforms.bluesky.metrics.secret = metric(1);
  const result = normalize(input, now);
  assert.equal(result.platforms.bluesky.metrics.followers.value, 83);
  assert.equal(result.platforms.bluesky.metrics.following.value, 0);
  assert.equal(result.platforms.bluesky.metrics.followers.sampledAt, metric().sampledAt);
  assert.equal(result.platforms.bluesky.metrics.posts, undefined);
  assert.equal(result.platforms.youtube, undefined);
  assert.ok(!JSON.stringify(result).includes('private'));
  assert.ok(!JSON.stringify(result).includes('secret'));
});
test('VPS rejects stale, future, rounded-without-precision, malformed and secret-bearing fields', () => {
  for (const change of [{current: false}, {value: '5K'}, {value: -1}, {sampledAt: '2030-01-01T00:00:00Z'}, {sampledAt: '2020-01-01T00:00:00Z'}, {precision: 'unverified'}, {source: {kind: 'public_api', url: 'https://example.org/?key=secret'}}]) {
    const input = bundle(); Object.assign(input.platforms.bluesky.metrics.followers, change);
    assert.equal(normalize(input, now).platforms.bluesky.metrics.followers, undefined);
  }
  assert.throws(() => normalize({version: 99}, now));
});
test('VPS fetch is fixed URL, redirect-denied, bounded, and classifies publication withdrawal', async () => {
  const result = await fetchSnapshot(async (url: string, init: RequestInit) => {
    assert.equal(url, SOURCE); assert.equal(init.redirect, 'error'); assert.ok(init.signal); assert.equal(init.headers && Object.keys(init.headers).length, 2);
    return Response.json(bundle());
  }, now);
  assert.equal(result.platforms.bluesky.metrics.followers.value, 83);
  await assert.rejects(fetchSnapshot(async () => new Response('denied', {status: 403}), now), /publication_unavailable/);
  await assert.rejects(fetchSnapshot(async () => new Response('x'.repeat(MAX_BYTES + 1), {headers: {'content-type': 'application/json'}}), now), /response_too_large/);
  await assert.rejects(fetchSnapshot(async () => new Response('<html>blocked</html>'), now), /invalid_response/);
});
test('VPS keeps verified public source identity parameters but rejects other query strings', () => {
  for (const url of ['https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=akasammythepuppy.me', 'https://decapi.me/twitch/followcount/1453387258?id=true', 'https://decapi.me/twitch/viewercount/1453387258?id=true']) {
    const input = bundle(); input.platforms.bluesky.metrics.followers.source.url = url;
    assert.equal(normalize(input, now).platforms.bluesky.metrics.followers.source.url, url);
  }
  const input = bundle(); input.platforms.bluesky.metrics.followers.source.url = 'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=akasammythepuppy.me&token=private';
  assert.equal(normalize(input, now).platforms.bluesky.metrics.followers, undefined);
});
test('VPS retention deletes only its expired snapshots and latest; same-slot writes are bounded', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'stratus-snapshot-'));
  try {
    await writeFile(join(directory, 'unrelated.txt'), 'preserve');
    await save(directory, normalize(bundle(), now), now);
    await save(directory, normalize(bundle(), now + 1000), now + 1000);
    assert.equal((await readdir(directory)).filter(name => name.startsWith('snapshot-')).length, 1);
    await prune(directory, now + RETENTION_MS + INTERVAL_MS);
    assert.deepEqual(await readdir(directory), ['unrelated.txt']);
    await save(directory, normalize(bundle(), now), now);
    await prune(directory, now, true);
    assert.equal(await readFile(join(directory, 'unrelated.txt'), 'utf8'), 'preserve');
    assert.deepEqual(await readdir(directory), ['unrelated.txt']);
  } finally {await rm(directory, {recursive: true});}
});
test('VPS local health never serves old metrics as successful or triggers new collection', () => {
  const state = {lastAttempt: now, lastSuccess: now, lastAttemptOK: true, error: null, latest: {ok: true}};
  assert.equal(responseFor('GET', '/health', state, now).status, 200);
  assert.equal(responseFor('HEAD', '/latest', state, now).status, 200);
  assert.equal(responseFor('GET', '/latest', {...state, lastAttemptOK: false}, now).status, 503);
  assert.equal(responseFor('GET', '/latest', state, now + INTERVAL_MS * 2).status, 503);
  assert.equal(responseFor('POST', '/latest', state, now).status, 405);
  assert.equal(responseFor('GET', '/latest?url=https://example.org', state, now).status, 404);
});
