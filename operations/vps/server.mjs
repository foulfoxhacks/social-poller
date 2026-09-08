import {createServer} from 'node:http';
import {fetchSnapshot, INTERVAL_MS, prune, responseFor, save} from './snapshot.mjs';

const directory = '/data';
const state = {lastAttempt: null, lastSuccess: null, lastAttemptOK: false, error: null, latest: null};
const codes = new Set(['publication_unavailable', 'upstream_unavailable', 'invalid_response', 'invalid_snapshot', 'response_too_large', 'snapshot_too_large']);
let stopping = false;
let timer;
async function collect() {
  state.lastAttempt = Date.now();
  state.lastAttemptOK = false;
  try {
    await prune(directory);
    const snapshot = await fetchSnapshot();
    await save(directory, snapshot);
    state.latest = snapshot;
    state.lastSuccess = Date.now();
    state.lastAttemptOK = true;
    state.error = null;
  } catch (error) {
    state.error = codes.has(error.message) ? error.message : 'collection_failed';
    state.latest = null;
    if (state.error === 'publication_unavailable') await prune(directory, Date.now(), true).catch(() => {state.error = 'cleanup_failed';});
  }
  console.log(JSON.stringify({event: 'snapshot_attempt', at: new Date().toISOString(), ok: state.lastAttemptOK, error: state.error}));
  // Serial bounded requests: no overlapping jobs, tight retries or visitor fetches.
  if (!stopping) timer = setTimeout(collect, INTERVAL_MS);
}
const server = createServer({requestTimeout: 5000, headersTimeout: 5000, maxHeaderSize: 4096}, (request, response) => {
  const result = responseFor(request.method, request.url, state);
  response.writeHead(result.status, {'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow', ...(result.status === 405 ? {allow: 'GET, HEAD'} : {})});
  response.end(request.method === 'HEAD' ? undefined : JSON.stringify(result.body));
});
server.maxConnections = 16;
server.listen(8080, '0.0.0.0', () => {void collect();}); // Host mapping is loopback-only.
function stop() {
  stopping = true;
  clearTimeout(timer);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
