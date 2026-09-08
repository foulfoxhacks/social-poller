import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import {empty,freshness,merge,combine,fromLegacy,toLegacy,input,owners,exportedProfile,SIX_HOURS,OWNER_KEY} from '../src/model.ts';
import {boundedText,parseCount,publicProfile} from '../src/providers.ts';
import {creator,saveCreator,saveExport,lookup} from '../src/service.ts';
import {escape,page} from '../src/ui.ts';

function setup(){
 const data=new Map<string,string>();
 const env={SNAPSHOTS:{async get(key:string|string[]){const one=(k:string)=>data.has(k)?JSON.parse(data.get(k)!):null;return Array.isArray(key)?new Map(key.map(k=>[k,one(k)])):one(key);},async put(key:string,value:string){data.set(key,value);}},READ_LIMIT:{async limit(){return {success:true};}},FETCH_LIMIT:{async limit(){return {success:true};}},IMPORT_TOKEN:'test-only-import-token-not-a-live-secret'};
 return {data,env:env as unknown as Env};
}
const now=()=>new Date().toISOString();
const sample=()=>({version:1,generatedAt:now(),platforms:Object.fromEntries(['instagram','tiktok','youtube','twitch','bluesky','x','github'].map(id=>[id,{metrics:{followers:{value:0,sampledAt:now(),current:true}},demographics:{}}]))});
const req=(path:string,init?:RequestInit)=>new Request('https://poller.example'+path,init);
const run=(r:Request,env:Env)=>worker.fetch(r,env,{} as ExecutionContext);

test('input has no arbitrary URLs, fragments, query strings, prototype keys or path traversal',()=>{
 for(const [p,u] of [['github','https://localhost/'],['github','a/b'],['github','a?x'],['__proto__','a'],['bluesky','localhost'],['github','..']])assert.throws(()=>input(p,u));
 assert.deepEqual(input('github','@FOULFOXHACKS'),{platform:'github',username:'foulfoxhacks'});
 assert.equal(input('bluesky','akasammythepuppy.me').username,'akasammythepuppy.me');
});
test('null differs from zero and freshness expires without changing observation times',()=>{
 const p=empty('github','example');p.metrics.followers={...p.metrics.followers,value:0,observedAt:now(),current:true};
 assert.equal(freshness(p).status,'partial');assert.equal(freshness(p,Date.now()+SIX_HOURS+1).status,'stale');assert.equal(p.metrics.followers.current,true);assert.equal(p.metrics.stars.value,null);
});
test('old persisted profiles gain newly supported unknown fields without changing history or imported reports',async()=>{
 const {env,data}=setup(),observed=now(),old=empty('x',owners.x,observed);
 delete old.metrics.following;
 old.metrics.followers={...old.metrics.followers,value:2,observedAt:observed,current:true,source:{kind:'owner_export',url:old.profileUrl}};
 old.metrics.periodViews={...old.metrics.followers,value:10,scope:'Reporting period: fixture'};
 data.set(OWNER_KEY,JSON.stringify([old]));
 const actual=await lookup(env,'x',owners.x);
 assert.equal(actual.metrics.following.value,null);assert.equal(actual.metrics.following.observedAt,null);assert.equal(actual.metrics.following.current,false);
 assert.deepEqual(actual.metrics.followers,old.metrics.followers);assert.deepEqual(actual.metrics.periodViews,old.metrics.periodViews);
 assert.equal(actual.checkedAt,observed);assert.equal(Object.hasOwn(old.metrics,'following'),false);
 assert.equal(toLegacy(await creator(env)).platforms.x.metrics.following.value,null);
 assert.deepEqual(JSON.parse(data.get(OWNER_KEY)!),[old]);
});
test('same-source failures retain old values as stale; independent sources retain fresh observations',()=>{
 const p=empty('github','example');p.metrics.stars={...p.metrics.stars,value:1,observedAt:now(),current:true};
 const next=empty('github','example');assert.equal(merge(p,next).metrics.stars.current,false);assert.equal(combine(p,next).metrics.stars.current,true);
 assert.throws(()=>combine(p,empty('github','other')),/identity/);
});

test('failed anonymous lookup cannot suppress an independent valid published snapshot',async()=>{
 const {env,data}=setup(),older=new Date(Date.now()-3600000).toISOString(),newer=new Date(Date.now()-1800000).toISOString();
 const published=empty('github',owners.github,older),failed=empty('github',owners.github,now());
 for(const m of Object.values(published.metrics))Object.assign(m,{value:4,observedAt:older,current:true,source:{kind:'public_api',url:'https://akasammythepuppy.me/assets/data/media-kit.json'}});
 for(const m of Object.values(failed.metrics))Object.assign(m,{value:4,observedAt:newer,current:false,source:{kind:'public_api',url:'https://api.github.com/users/foulfoxhacks'}});
 failed.reason='upstream_limited';data.set(OWNER_KEY,JSON.stringify([published]));data.set(`lookup:github:${owners.github}`,JSON.stringify(failed));
 const result=await creator(env);assert.equal(result[0].metrics.followers.current,true);assert.equal(result[0].metrics.followers.observedAt,older);
 const fetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Must reuse the existing publisher, not perform anonymous reads');};
 try{const lookupResult=await lookup(env,'github',owners.github,true);assert.equal(lookupResult.metrics.followers.current,true);assert.equal(lookupResult.metrics.followers.observedAt,older);}finally{globalThis.fetch=fetch;}
 const expired=structuredClone(published);for(const m of Object.values(expired.metrics))m.observedAt=new Date(Date.now()-SIX_HOURS-1).toISOString();
 assert.equal(combine(expired,failed).metrics.followers.current,false);
 const same=structuredClone(failed);for(const m of Object.values(same.metrics))m.source=published.metrics.followers.source;
 assert.equal(combine(published,same).metrics.followers.current,false);
 assert.equal(combine(published,{...empty('github',owners.github),reason:'profile_not_public'}).metrics.followers.value,null);
});
test('imports reject incomplete snapshots and strip private fields, HTML labels and unsupported demographics',()=>{
 assert.throws(()=>fromLegacy({version:1,generatedAt:now(),platforms:{}}));
 const s:any=sample();s.platforms.instagram.access_token='private';s.platforms.instagram.metrics.followers.name='private';
 s.platforms.instagram.demographics={country:{sampledAt:now(),current:true,window:'last_30_days',rows:[{key:'US',label:'<img onerror=alert(1)>',percent:55},{key:'private-user',percent:45}]},city:{rows:[{name:'private',percent:100}]}};
 const p=fromLegacy(s);assert.equal(p[0].metrics.followers.value,0);assert.equal(p[0].demographics?.country.rows[0].label,'US');
 assert.doesNotMatch(JSON.stringify(p),/private|onerror|access_token|city/);assert.equal(toLegacy(p).generatedAt,s.generatedAt);
});
test('demographic duplicates, wrong periods and impossible totals are omitted',()=>{
 const s:any=sample();s.platforms.instagram.demographics={country:{sampledAt:now(),current:true,window:'last_30_days',rows:[{key:'US',percent:55},{key:'US',percent:55}]}};
 assert.deepEqual(fromLegacy(s)[0].demographics?.country.rows,[]);
});
test('owner export only accepts registered identity, recognized finite metrics and real dates',()=>{
 const data={platform:'instagram',username:owners.instagram,observedAt:now(),metrics:{followers:5500},precision:{followers:'rounded'}};
 const p=exportedProfile(data);assert.equal(p.metrics.followers.precision,'rounded');assert.equal(p.metrics.followers.source.kind,'owner_export');
 assert.throws(()=>exportedProfile({...data,username:'someoneelse'}));assert.throws(()=>exportedProfile({...data,metrics:{followers:-1}}));assert.throws(()=>exportedProfile({...data,metrics:{private:12}}));assert.throws(()=>exportedProfile({...data,observedAt:'2100-01-01'}));
});
test('owner count parsing preserves rounding rather than implying exactness',()=>{
 assert.deepEqual(parseCount('5.5K'),{value:5500,precision:'rounded'});assert.deepEqual(parseCount('1,234'),{value:1234,precision:'exact'});
 for(const value of ['-1','unknown','1e9','5 followers','1,2','Infinity'])assert.equal(parseCount(value),null);
});
test('bounded input rejects both advertised and streamed oversize payloads',async()=>{
 await assert.rejects(()=>boundedText(new Response('a',{headers:{'content-length':'30'}}),2),/payload_too_large/);
 await assert.rejects(()=>boundedText(new Response('abc'),2),/payload_too_large/);assert.equal(await boundedText(new Response('ab'),2),'ab');
});
test('provider uses fixed public API and verifies exact identity',async()=>{
 const urls:string[]=[];
 const fetcher=async(url:any,init:any)=>{urls.push(String(url));assert.equal(init.redirect,'manual');return Response.json({handle:'example.bsky.social',followersCount:3,followsCount:4,postsCount:5});};
 const p=await publicProfile('bluesky','example.bsky.social',fetcher as typeof fetch);assert.equal(p.metrics.followers.value,3);assert.match(urls[0],/^https:\/\/public.api.bsky.app\/xrpc\//);
 await assert.rejects(()=>publicProfile('bluesky','other.bsky.social',fetcher as typeof fetch),/identity_mismatch/);
 await assert.rejects(()=>publicProfile('tiktok','someone',fetcher as typeof fetch),/connection_required/);
});
test('provider counts all returned owned repositories and omits incomplete star totals',async()=>{
 const fetcher=async(url:any)=>String(url).includes('/repos?')?Response.json([{owner:{login:'example'},stargazers_count:4}]):Response.json({login:'example',followers:0,following:1,public_repos:1});
 const p=await publicProfile('github','example',fetcher as typeof fetch);assert.equal(p.metrics.stars.value,4);assert.equal(p.metrics.followers.value,0);
});
test('public lookup, manual export and published aggregate snapshots cannot clobber each other',async()=>{
 const {env,data}=setup();const base=fromLegacy(sample());await saveCreator(env,base);const original=data.get(OWNER_KEY);
 await saveExport(env,exportedProfile({platform:'facebook',username:owners.facebook,observedAt:now(),metrics:{followers:4}}));
 assert.equal(data.get(OWNER_KEY),original);const profiles=await creator(env);assert.equal(profiles.find(p=>p.platform==='facebook')?.metrics.followers.value,4);
 const other=await lookup(env,'instagram','unrelated');assert.equal(other.metrics.followers.value,null);assert.equal(other.reason,'connection_or_owner_export_required');
 const old=sample();old.generatedAt='2020-01-01T00:00:00Z';await assert.rejects(()=>saveCreator(env,fromLegacy(old)),/older_snapshot/);
});
test('HTML escapes untrusted usernames; widget has isolated layout and no social script',()=>{
 assert.equal(escape('<script>"&'), '&lt;script&gt;&quot;&amp;');
 const p=empty('github','example');p.username='<script>evil</script>';
 const html=page('https://poller.example',p,undefined,true);assert.doesNotMatch(html,/<script>evil/);assert.match(html,/class="widget"/);
});
test('HTTP imports fail closed, validate type, bound data and permit no cross-origin writes',async()=>{
 const {env}=setup();let response=await run(req('/v1/import/media-kit',{method:'POST'}),env);assert.equal(response.status,401);assert.equal(response.headers.get('access-control-allow-origin'),null);
 const headers={authorization:'Bearer '+env.IMPORT_TOKEN,'content-type':'application/json'};
 response=await run(req('/v1/import/media-kit',{method:'POST',headers,body:JSON.stringify(sample())}),env);assert.equal(response.status,200);assert.deepEqual(await response.json(),{accepted:7});
 response=await run(req('/v1/import/media-kit',{method:'POST',headers,body:'{'}),env);assert.equal(response.status,400);
 response=await run(req('/v1/import/media-kit',{method:'POST',headers,body:' '.repeat(65537)}),env);assert.equal(response.status,400);
 response=await run(req('/v1/import/media-kit',{method:'GET'}),env);assert.equal(response.status,405);
});
test('read API exposes explicit unavailable states, HEAD, CORS and noindex separately from creator site',async()=>{
 const {env}=setup();let r=await run(req('/v1/media-kit/akasammythepuppy'),env);assert.equal(r.status,503);
 r=await run(req('/v1/search?platform=instagram&username=unrelated'),env);assert.equal(r.status,200);assert.equal((await r.json()).status,'unavailable');assert.equal(r.headers.get('access-control-allow-origin'),'*');
 r=await run(req('/health',{method:'HEAD'}),env);assert.equal(r.status,200);assert.equal(await r.text(),'');assert.equal(r.headers.get('x-robots-tag'),'noindex, follow');
 r=await run(req('/v1/search?platform=github&username=https://localhost'),env);assert.equal(r.status,400);
 r=await run(req('/',{method:'POST'}),env);assert.equal(r.status,405);
});
test('native rate-limit denial returns retry-after and does not attempt lookup',async()=>{
 const {env}=setup();env.READ_LIMIT.limit=async()=>({success:false});
 const r=await run(req('/v1/search?platform=github&username=example'),env);assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');
});
