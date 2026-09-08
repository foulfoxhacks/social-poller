import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../src/stratus.ts';
import {empty,owners} from '../src/model.ts';
import {graph} from '../src/views.ts';
import type {History} from '../src/history.ts';
const at=new Date().toISOString();
const p=empty('bluesky',owners.bluesky,at);
p.metrics.followers={...p.metrics.followers,value:83,observedAt:at,current:true,precision:'exact'};
const calls:Request[]=[];
const env={STRATUS_READ_LIMIT:{limit:async()=>({success:true})},BRAND_ASSETS:{fetch:async()=>new Response('logo',{headers:{'content-type':'image/png'}})},COLLECTOR:{fetch:async(r:Request)=>{calls.push(r);return Response.json(r.url.includes('/creators/')?{profiles:[p]}:r.url.includes('/history/')?{platform:p.platform,username:p.username,metric:'followers',days:30,points:[],note:'No artificial history'}:p);}}} as unknown as StratusEnv;
const request=(path:string,init?:RequestInit)=>worker.fetch(new Request('https://stratus.test'+path,init),env,{} as ExecutionContext);
test('Stratus homepage, docs and coverage are indexable static HTML; query pages are not',async()=>{
 for(const path of ['/','/docs/','/status/']){const r=await request(path);assert.equal(r.status,200);assert.equal(r.headers.get('x-robots-tag'),'index, follow');const text=await r.text();assert.match(text,/<h1[ >]/);assert.match(text,/name="robots" content="index, follow"/);assert.match(text,/https:\/\/stratussocial.mellozone.site/);}
 const query=await request('/?platform=bluesky&username='+p.username);assert.equal(query.status,200);assert.equal(query.headers.get('x-robots-tag'),'noindex, follow');assert.match(await query.text(),/content="noindex, follow"/);
 for(const path of ['/?tracking=x','/docs/?username=x','/status/?test=x'])assert.equal((await request(path)).status,308);
});
test('fixed service binding forwards public GET only, with no caller secrets or URL proxy',async()=>{
 calls.length=0;const r=await request('/v1/profiles/bluesky/'+p.username+'?url=https://private.invalid',{headers:{authorization:'private',cookie:'private'}});
 assert.equal(r.status,200);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://social-poller.internal/v1/profiles/bluesky/'+p.username);assert.equal(calls[0].method,'GET');assert.equal(calls[0].headers.get('cookie'),null);assert.equal(calls[0].headers.get('authorization'),null);
 assert.equal((await request('/v1/profiles/github/https%3A%2F%2Fexample.test')).status,400);
 assert.equal((await request('/v1/profiles/github/%ZZ')).status,400);
});
test('no write endpoint, paid fallback, or YouTube collection crosses the binding',async()=>{
 calls.length=0;assert.equal((await request('/v1/import/media-kit',{method:'POST',body:'{}'})).status,405);
 assert.equal((await request('/v1/import/media-kit')).status,404);
 assert.equal((await request('/v1/profiles/youtube/'+owners.youtube)).status,403);assert.equal(calls.length,0);
 const schema=await (await request('/openapi.json')).json() as any;
 assert.ok(Object.values(schema.paths).every((v:any)=>!v.post));assert.doesNotMatch(JSON.stringify(schema.paths),/import|Bearer/);
 const config=JSON.parse(readFileSync(new URL('../wrangler.stratus.jsonc',import.meta.url),'utf8'));assert.equal(config.kv_namespaces,undefined);assert.equal(config.secrets,undefined);assert.equal(config.d1_databases.length,1);assert.equal(config.d1_databases[0].binding,'OAUTH_HANDOFFS');assert.equal(config.observability.logs.invocation_logs,false);
});
test('HEAD, CORS, CSP, input ranges, error responses and limiter fail closed',async()=>{
 const head=await request('/docs/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 const options=await request('/v1/platforms',{method:'OPTIONS'});assert.equal(options.status,204);assert.equal(options.headers.get('access-control-allow-origin'),'*');
 assert.equal((await request('/v1/history/bluesky/'+p.username+'?days=99999')).status,400);
 assert.equal((await request('/v1/history/bluesky/'+p.username+'?metric=private')).status,400);
 const frame=await request('/widget?platform=bluesky&username='+p.username+'&view=graph&theme=creator');assert.equal(frame.status,200);assert.match(await frame.text(),/class="theme-creator"/);assert.match(frame.headers.get('content-security-policy')!,/frame-ancestors \*/);
 const deny={...env,STRATUS_READ_LIMIT:{limit:async()=>({success:false})}} as StratusEnv;
 const r=await worker.fetch(new Request('https://test/v1/platforms'),deny,{} as ExecutionContext);assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');
 const broken={...env,STRATUS_READ_LIMIT:{limit:async()=>{throw Error('private diagnostics')}}} as StratusEnv;
 const failed=await worker.fetch(new Request('https://test/v1/platforms'),broken,{} as ExecutionContext);assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/diagnostics/);
 assert.equal((await worker.fetch(new Request('https://test/docs/'),broken,{} as ExecutionContext)).status,200);
});
test('UI validates upstream identity and JSON type instead of presenting someone else’s metrics',async()=>{
 for(const result of [Response.json({...p,username:'another.test'}),new Response('challenge',{headers:{'content-type':'text/html'}})]){
 const wrong={...env,COLLECTOR:{fetch:async()=>result}} as unknown as StratusEnv;
 const r=await worker.fetch(new Request('https://test/widget?platform=bluesky&username='+p.username),wrong,{} as ExecutionContext);assert.equal(r.status,503);
 }
});
test('graph defaults select an observed metric and seven-day hourly range; explicit choices are preserved',async()=>{
 const profile=empty('tiktok',owners.tiktok,at);profile.metrics.averageViews={...profile.metrics.averageViews,value:100,current:true,observedAt:at};
 const seen:string[]=[];const fixture={...env,COLLECTOR:{fetch:async(r:Request)=>{seen.push(r.url);return Response.json(r.url.includes('/history/')?{platform:profile.platform,username:profile.username,metric:'averageViews',days:7,points:[],note:'Hourly'}:profile);}}} as unknown as StratusEnv;
 let r=await worker.fetch(new Request('https://test/widget?platform=tiktok&username='+owners.tiktok+'&view=graph'),fixture,{} as ExecutionContext);assert.equal(r.status,200);assert.match(seen.at(-1)!,/metric=averageViews&days=7/);
 r=await worker.fetch(new Request('https://test/widget?platform=tiktok&username='+owners.tiktok+'&view=graph&metric=followers&days=30'),fixture,{} as ExecutionContext);assert.equal(r.status,200);assert.match(seen.at(-1)!,/metric=followers&days=30/);
});
test('new charts separate URLs and sample sizes, preserve gaps and disclose the axis range',()=>{
 const point={observedAt:'2026-09-01T00:00:00Z',value:100,scope:'Account',precision:'exact' as const,sourceKind:'public_api',sourceUrl:'https://source.test/a',sampleSize:null};
 const data:History={platform:'bluesky',username:p.username,metric:'followers',days:30,note:'Actual observations',points:[point,{...point,observedAt:'2026-09-02T00:00:00Z',value:101}]};
 let out=graph(data);assert.match(out,/<polyline/);assert.match(out,/not zero-based/);assert.match(out,/Latest observed/);
 data.points[1].sourceUrl='https://source.test/b';assert.doesNotMatch(graph(data),/<polyline/);
 data.points[1]={...point,observedAt:'2026-09-05T00:00:00Z'};assert.doesNotMatch(graph(data),/<polyline/);
 data.points[1]={...point,sampleSize:12};assert.doesNotMatch(graph(data),/<polyline/);
});
