import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizeContent,saveContent,content,withdrawContent} from '../src/content.ts';
import {input,fields,owners} from '../src/model.ts';
import worker from '../src/index.ts';
const now=Date.now(),date=new Date(now-60000).toISOString();
const fixture=()=>({version:1,platform:'tiktok',username:owners.tiktok,observedAt:date,source:{kind:'authorized_api',url:'https://www.tiktok.com/@akasammythepuppy'},coverage:'recent_sample',posts:[{id:'123',url:'https://www.tiktok.com/@akasammythepuppy/video/123',title:'A real sample title',publishedAt:date,metrics:{views:100,likes:10,comments:0,shares:2},access_token:'SECRET'}]});
function env(){const rows=new Map();return {SNAPSHOTS:{get:async(k:string)=>rows.get(k)||null,put:async(k:string,v:string)=>rows.set(k,JSON.parse(v)),delete:async(k:string)=>rows.delete(k)}} as unknown as Env;}
test('LinkedIn is not accepted in dataset, lookup or content imports',()=>{assert.equal(fields.linkedin,undefined);assert.equal(owners.linkedin,undefined);assert.throws(()=>input('linkedin','foulfoxhacks'));assert.throws(()=>normalizeContent({...fixture(),platform:'linkedin'}));});
test('Reddit net scores may be negative, but counts and unknown fields may not',()=>{
 const f={...fixture(),platform:'reddit',username:owners.reddit,source:{kind:'authorized_api',url:'https://www.reddit.com/user/'+owners.reddit},posts:[{...fixture().posts[0],id:'t3_abc',url:'https://www.reddit.com/r/example/comments/abc/test/',metrics:{score:-2,comments:0}}]};
 assert.equal(normalizeContent(f).posts[0].metrics.score,-2);assert.throws(()=>normalizeContent({...f,posts:[{...f.posts[0],metrics:{score:1,comments:-2}}]}));
});
test('content imports are owner-bound, bounded and strip private fields',()=>{
 assert.doesNotMatch(JSON.stringify(normalizeContent(fixture())),/SECRET|access_token/);
 for(const mutation of [{username:'other'},{posts:Array.from({length:21},()=>fixture().posts[0])},{observedAt:'2000-01-01'},{source:{kind:'authorized_api',url:'https://private.test'}}])assert.throws(()=>normalizeContent({...fixture(),...mutation}));
 for(const url of ['javascript:alert(1)','https://evil.test/post','https://www.tiktok.com:8443/post','https://www.tiktok.com/post?token=SECRET','https://www.tiktok.com/@someoneelse/video/123'])assert.throws(()=>normalizeContent({...fixture(),posts:[{...fixture().posts[0],url}]}));
});
test('content normalization sanitizes titles, checks time causality and sorts newest first deterministically',()=>{
 const base=fixture(),older=new Date(now-120000).toISOString(),newer=new Date(now-30000).toISOString();
 const posts=[
  {...base.posts[0],id:'b',url:'https://www.tiktok.com/@akasammythepuppy/video/124',publishedAt:newer,title:' Newer\u0000 title '},
  {...base.posts[0],id:'a',url:'https://www.tiktok.com/@akasammythepuppy/video/125',publishedAt:newer,title:'Same-time A'},
  {...base.posts[0],id:'c',url:'https://www.tiktok.com/@akasammythepuppy/video/126',publishedAt:older,title:'Older'}
 ];
 const normalized=normalizeContent({...base,observedAt:new Date(now).toISOString(),posts});
 assert.deepEqual(normalized.posts.map(post=>post.id),['a','b','c']);assert.equal(normalized.posts[1].title,'Newer  title');
 assert.throws(()=>normalizeContent({...base,posts:[{...base.posts[0],title:'\u0000\u0001'}]}),/invalid_content/);
 assert.throws(()=>normalizeContent({...base,posts:[{...base.posts[0],publishedAt:new Date(now+30000).toISOString()}]}),/invalid_content/);
});
test('same-observation corrections replace changed payloads without fabricating a zero-duration trend',async()=>{
 let saved:any;const e={SNAPSHOTS:{get:async()=>saved||null,put:async(_k:string,v:string)=>{saved=JSON.parse(v);},delete:async()=>{saved=null;}}} as unknown as Env;
 const first=fixture();await saveContent(e,first);const corrected=fixture();corrected.posts[0].metrics.views=125;await saveContent(e,corrected);
 assert.equal(saved.latest.posts[0].metrics.views,125);assert.equal(saved.previous,null);
 const unchanged=JSON.stringify(saved);await saveContent(e,corrected);assert.equal(JSON.stringify(saved),unchanged);
});
test('rankings retain sample meaning and need two compatible observations for gains',async()=>{
 const e=env(),first=fixture();await saveContent(e,first);let r=await content(e,'tiktok',owners.tiktok,now);assert.equal(r.posts[0].interactions,12);assert.equal(r.posts[0].change,null);
 const next=fixture();next.observedAt=new Date(now).toISOString();next.posts[0].metrics.views=130;next.posts[0].metrics.likes=15;await saveContent(e,next);
 r=await content(e,'tiktok',owners.tiktok,now);assert.equal(r.posts[0].change?.views,30);assert.equal(r.posts[0].change?.interactions,5);assert.equal(r.sampleSize,1);
 await assert.rejects(saveContent(e,first),/older_snapshot/);
 assert.equal((await content(e,'tiktok',owners.tiktok,now+86400001)).posts.length,0);
 await withdrawContent(e,'tiktok',owners.tiktok);assert.equal((await content(e,'tiktok',owners.tiktok,now)).posts.length,0);
});
test('replacement removes absent posts and YouTube receives no derived interaction or trend score',async()=>{
 const e=env(),p={...fixture(),platform:'youtube',source:{kind:'public_api',url:'https://www.youtube.com/@akasammythepuppy'},posts:[{id:'123',url:'https://www.youtube.com/watch?v=123',title:'Video',publishedAt:date,metrics:{views:10,likes:2,comments:1}}]};
 await saveContent(e,p);p.observedAt=new Date(now).toISOString();p.posts[0].metrics.views=20;await saveContent(e,p);let r=await content(e,'youtube',owners.youtube,now);assert.equal(r.posts[0].interactions,null);assert.equal(r.posts[0].change,null);
 await saveContent(e,{...p,observedAt:new Date(now+1).toISOString(),posts:[]});r=await content(e,'youtube',owners.youtube,now);assert.deepEqual(r.posts,[]);
});
test('content writes require authorization and older samples retain their own expiry',async()=>{
 const e=env() as any;e.READ_LIMIT={limit:async()=>({success:true})};e.IMPORT_TOKEN='t'.repeat(32);
 const req=(authorized:boolean)=>new Request('https://poller.test/v1/import/content',{method:'POST',headers:{'content-type':'application/json',...(authorized?{authorization:'Bearer '+e.IMPORT_TOKEN}:{})},body:JSON.stringify(fixture())});
 assert.equal((await worker.fetch(req(false),e,{} as ExecutionContext)).status,401);
 assert.equal((await worker.fetch(req(true),e,{} as ExecutionContext)).status,200);
 const result=await worker.fetch(new Request('https://poller.test/v1/content/tiktok/'+owners.tiktok),e,{} as ExecutionContext);assert.equal((await result.json() as any).sampleSize,1);
 const first=fixture();first.observedAt=new Date(now-3600000).toISOString();let saved:any,expiration=0;
 const bounded={SNAPSHOTS:{get:async()=>saved,put:async(k:string,v:string,opts:any)=>{saved=JSON.parse(v);expiration=opts.expiration;}}} as unknown as Env;
 await saveContent(bounded,first);const next={...fixture(),posts:[]};await saveContent(bounded,next);
 assert.deepEqual(saved.previous.posts,[]);assert.equal(expiration,Math.floor((Date.parse(first.observedAt)+86400000)/1000));
});
