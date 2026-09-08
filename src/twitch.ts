import {empty,owners,scope,type Profile} from './model.ts';
import {boundedText} from './providers.ts';

// Documented, keyless third-party API; no Twitch page scraping or auth bypass.
// https://docs.decapi.me/twitch and /cached-endpoints. Source cache: 120s/300s.
const ORIGIN='https://decapi.me';
const OWNER_ID='1453387258';
async function text(path:string,fetcher:typeof fetch):Promise<string> {
  const r=await fetcher(ORIGIN+path,{redirect:'manual',signal:AbortSignal.timeout(6000),headers:{'User-Agent':'SocialPoller/0.2 (+https://github.com/foulfoxhacks/social-poller)','Accept':'text/plain'}});
  if(!r.ok){await r.body?.cancel();throw Error([403,429].includes(r.status)?'upstream_limited':'upstream_unavailable');}
  if(!(r.headers.get('content-type')||'').startsWith('text/plain')){await r.body?.cancel();throw Error('invalid_counter_response');}
  return (await boundedText(r,1024)).trim();
}
export function integerCounter(body:string):number {
  if(!/^\d+$/.test(body)||!Number.isSafeInteger(Number(body)))throw Error('invalid_counter_response');
  return Number(body);
}
export async function twitchProfile(username:string,fetcher:typeof fetch=fetch):Promise<Profile> {
  if(!/^[a-z0-9_]{1,25}$/.test(username))throw Error('invalid_profile');
  const id=await text(`/twitch/id/${encodeURIComponent(username)}`,fetcher);
  if(!/^\d{1,20}$/.test(id)||(username===owners.twitch&&id!==OWNER_ID))throw Error('identity_mismatch');
  // Counts use the resolved ID, avoiding a rename between lookup and collection.
  const p=empty('twitch',username);
  const results=await Promise.allSettled(['followcount','viewercount'].map(async(endpoint)=>{
    const path=`/twitch/${endpoint}/${id}?id=true`,body=await text(path,fetcher);
    const key=endpoint==='followcount'?'followers':'viewers';
    // Only the provider's exact offline response is a real zero. Errors are not.
    const value=key==='viewers'&&body===`${id} is offline`?0:integerCounter(body);
    p.metrics[key]={value,observedAt:new Date().toISOString(),current:true,precision:'exact',scope:scope(key),source:{kind:'third_party_api',url:ORIGIN+path}};
  }));
  if(results.some(r=>r.status==='rejected'))p.reason='some_public_counters_unavailable';
  p.checkedAt=new Date().toISOString();
  return p;
}
