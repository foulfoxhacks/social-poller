import {test} from 'node:test';
import assert from 'node:assert/strict';
import {twitchProfile,integerCounter} from '../src/twitch.ts';
import {empty,freshness,merge,combine,toLegacy,TEN_MINUTES,refreshInterval} from '../src/model.ts';
import {creator,lookup} from '../src/service.ts';

function fixture(values:Record<string,string>={},id='1453387258') {
  const calls:string[]=[];
  const fetcher:typeof fetch=async(url,init)=>{
    const u=new URL(String(url));calls.push(u.href);
    assert.equal(u.origin,'https://decapi.me');assert.equal(init?.redirect,'manual');
    assert.ok(init?.signal);assert.equal(new Headers(init?.headers).get('cookie'),null);
    const key=u.pathname.split('/')[2];
    if(key!=='id'){assert.equal(u.pathname.split('/')[3],id);assert.equal(u.search,'?id=true');}
    return new Response(values[key]??({id,followcount:'25',viewercount:`${id} is offline`}[key]),{headers:{'content-type':'text/plain; charset=utf-8'}});
  };
  return {calls,fetcher};
}
test('keyless Twitch adapter resolves a pinned identity and parses only aggregate counters',async()=>{
  const f=fixture(),p=freshness(await twitchProfile('akasammythepuppy',f.fetcher));
  assert.equal(f.calls.length,3);assert.equal(p.metrics.followers.value,25);
  assert.equal(p.metrics.viewers.value,0);assert.equal(p.status,'current');
  assert.equal(p.metrics.followers.source.kind,'third_party_api');
  assert.match(p.metrics.followers.source.url,/followcount\/1453387258\?id=true$/);
  assert.equal(refreshInterval('twitch'),300000);
});
test('Twitch rejects reassigned owner handles, unsafe input and HTTP-200 error messages',async()=>{
  const f=fixture({},'987');await assert.rejects(()=>twitchProfile('akasammythepuppy',f.fetcher),/identity_mismatch/);assert.equal(f.calls.length,1);
  await assert.rejects(()=>twitchProfile('../evil',f.fetcher),/invalid_profile/);
  for(const value of ['Error 123','1.5','-1','25K','<b>25</b>','9007199254740992',''])assert.throws(()=>integerCounter(value));
  const p=await twitchProfile('akasammythepuppy',fixture({followcount:'[Error from Twitch API] 401',viewercount:'someone is offline'}).fetcher);
  assert.equal(p.metrics.followers.value,null);assert.equal(p.metrics.viewers.value,null);
  assert.equal(p.reason,'some_public_counters_unavailable');
});
test('partial failures retain dated stale counters while a real viewer zero stays current',async()=>{
  const old=await twitchProfile('akasammythepuppy',fixture().fetcher);
  const next=await twitchProfile('akasammythepuppy',fixture({followcount:'error'}).fetcher);
  const p=merge(old,next);assert.equal(p.metrics.followers.value,25);
  assert.equal(p.metrics.followers.observedAt,old.metrics.followers.observedAt);assert.equal(p.metrics.followers.current,false);
  assert.equal(p.metrics.viewers.current,true);
});
test('public counters expire after ten minutes and legacy output retains provenance',async()=>{
  const p=await twitchProfile('akasammythepuppy',fixture().fetcher);
  const stale=freshness(p,Date.parse(p.checkedAt)+TEN_MINUTES+1);
  assert.equal(stale.status,'stale');assert.equal(stale.metrics.followers.value,25);
  const source=toLegacy([p]).platforms.twitch.metrics.followers.source;
  assert.equal(source.kind,'third_party_api');assert.match(source.url,/decapi/);
  const imported=empty('twitch','akasammythepuppy');
  assert.equal(combine(imported,p).metrics.followers.value,25);
});
test('provider refuses redirects, rate limiting, unexpected content and oversized data',async()=>{
  for(const r of [new Response(null,{status:302,headers:{location:'https://other.example'}}),new Response(null,{status:429}),new Response('1453387258',{headers:{'content-type':'text/html'}}),new Response('1'.repeat(1025),{headers:{'content-type':'text/plain'}})]){
    await assert.rejects(()=>twitchProfile('akasammythepuppy',async()=>r));
  }
});
test('Twitch lookup cache participates in creator relay without overwriting imports',async()=>{
  const p=await twitchProfile('akasammythepuppy',fixture().fetcher);
  const store=new Map([['lookup:twitch:akasammythepuppy',p]]);
  const env={SNAPSHOTS:{async get(key:string|string[]){return Array.isArray(key)?new Map(key.map(k=>[k,store.get(k)||null])):store.get(key)||null;}}} as unknown as Env;
  assert.equal((await creator(env)).find(p=>p.platform==='twitch')?.metrics.followers.value,25);
  assert.equal((await lookup(env,'twitch','akasammythepuppy')).metrics.followers.value,25);
});
