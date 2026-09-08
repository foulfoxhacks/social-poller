import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseSavedPage,initialData,PAGE_LIMIT} from '../src/page-parser.ts';
import {exportedProfile,owners} from '../src/model.ts';

// Synthetic contract fixtures, not captured platform pages or creator metrics.
const when='2026-09-01T12:00:00Z',name='example';
const script=(id:string,value:unknown)=>`<script id="${id}" type="application/json">${JSON.stringify(value)}</script>`;
const meta=(platform:string)=>`<meta property="og:url" content="https://${platform}.com/${platform==='youtube'?'@':''}${name}">`;
const tik=(user:Record<string,unknown>={},stats:Record<string,unknown>={},extra:Record<string,unknown>={})=>script('__UNIVERSAL_DATA_FOR_REHYDRATION__',{__DEFAULT_SCOPE__:{'webapp.user-detail':{userInfo:{user:{uniqueId:name,id:'12345',...user},stats:{followerCount:1234,followingCount:0,videoCount:12,heartCount:5678,diggCount:999,...stats},...extra}}}});
const yt=(header:unknown,metadata:Record<string,unknown>={})=>`<script>var ytInitialData = ${JSON.stringify({metadata:{channelMetadataRenderer:{externalId:'UCabcdefghijklmnopqrstuv',vanityChannelUrl:'https://www.youtube.com/@example',...metadata}},header})}; window.unrelated = 'do not execute';</script>`;
test('TikTok emits aggregate allowlist, exact zero and original date; never raw account fields',()=>{
 const p=parseSavedPage(tik({secUid:'private-session-value',email:'do-not-upload@example.test'}),'tiktok',name,when);
 assert.deepEqual(p.observation.metrics,{followers:1234,following:0,posts:12,likes:5678});
 assert.equal(p.observation.observedAt,'2026-09-01T12:00:00.000Z');assert.equal(p.sourceKind,'owner_export');
 assert.ok(p.missing.includes('averageViews'));assert.doesNotMatch(JSON.stringify(p),/private-session|email|secUid|diggCount|999/);
});
test('TikTok legacy user map and precise statsV2 supported without selecting another account',()=>{
 const legacy=script('SIGI_STATE',{UserModule:{users:{example:{uniqueId:name,id:'123'}},stats:{example:{followerCount:0}}}});
 assert.equal(parseSavedPage(legacy,'tiktok',name,when).observation.metrics.followers,0);
 assert.equal(parseSavedPage(tik({}, {},{statsV2:{followerCount:'1235'}}),'tiktok',name,when).observation.metrics.followers,1235);
 assert.throws(()=>parseSavedPage(legacy,'tiktok','someoneelse',when),/identity_mismatch/);
});
test('TikTok rejects wrong identities and explicitly private accounts',()=>{
 for(const user of [{uniqueId:'other'},{id:'not-an-id'}])assert.throws(()=>parseSavedPage(tik(user),'tiktok',name,when),/identity_mismatch/);
 for(const user of [{privateAccount:true},{secret:true}])assert.throws(()=>parseSavedPage(tik(user),'tiktok',name,when),/private_profile/);
 assert.throws(()=>parseSavedPage(tik()+tik(),'tiktok',name,when),/conflicting_counters/);
});
test('YouTube balanced JSON extraction does not execute code or consume unrelated view counts',()=>{
 const raw={label:'quoted } and \\" string',nested:{a:1}};
 assert.deepEqual(initialData(`window["ytInitialData"] = ${JSON.stringify(raw)}; throw Error('never run');`),raw);
 assert.throws(()=>initialData('ytInitialData = {broken'),/unsupported/);
 const p=parseSavedPage(yt({c4TabbedHeaderRenderer:{subscriberCountText:{simpleText:'5.5K subscribers'},videosCountText:{runs:[{text:'123 videos'}]}},video:{viewCount:100000}}),'youtube',name,when);
 assert.deepEqual(p.observation.metrics,{followers:5500,posts:123});assert.equal(p.observation.precision.followers,'rounded');assert.ok(p.missing.includes('views'));
});
test('YouTube modern channel header verifies handle and owner channel ID',()=>{
 const html=yt({pageHeaderRenderer:{content:{pageHeaderViewModel:{metadata:{contentMetadataViewModel:{metadataRows:[{metadataParts:[{text:{content:'566 subscribers'}},{text:{content:'20 videos'}}]}]}}}}}});
 assert.equal(parseSavedPage(html,'youtube',name,when).observation.metrics.followers,566);
 assert.throws(()=>parseSavedPage(html,'youtube','wrong',when),/identity/);
 assert.throws(()=>parseSavedPage(yt({}, {vanityChannelUrl:`https://www.youtube.com/@${owners.youtube}`}),'youtube',owners.youtube,when),/identity/);
});
test('Instagram recognized English metadata supports rounding, entities and zero',()=>{
 const p=parseSavedPage(meta('instagram')+`<meta property='og:description' content='5.5K Followers, 0 Following, 123 Posts - Example &amp; friends'>`,'instagram',name,when);
 assert.deepEqual(p.observation.metrics,{followers:5500,following:0,posts:123});assert.equal(p.observation.precision.followers,'rounded');
 assert.throws(()=>parseSavedPage(`<meta property="og:description" content="1 Followers, 2 Following, 3 Posts - bio">`,'instagram',name,when),/identity/);
 assert.throws(()=>parseSavedPage(meta('instagram')+'<p>My bio says 555 Followers</p>','instagram',name,when),/no_recognized/);
});
test('X parses only same-profile labeled count links, not bio or post likes',()=>{
 const html=meta('x')+`<a href="/${name}/following"><strong>11</strong> Following</a><a href="https://x.com/${name}/followers">1,234 Followers</a><a href="https://evil.test/${name}/followers">999 Followers</a><a href="/other/followers">888 Followers</a><a href="https://[bad">ignore</a><p>Posts 555</p>`;
 assert.deepEqual(parseSavedPage(html,'x',name,when).observation.metrics,{following:11,followers:1234});
});
test('Facebook only accepts identified profile JSON-LD aggregate interactions',()=>{
 const p=parseSavedPage(`<script type="application/ld+json">${JSON.stringify({'@type':'ProfilePage',mainEntity:{'@type':'Person',url:'https://www.facebook.com/example',interactionStatistic:[{interactionType:{'@type':'FollowAction'},userInteractionCount:100},{interactionType:'https://schema.org/LikeAction',userInteractionCount:90}],email:'private'}})}</script>`,'facebook',name,when);
 assert.deepEqual(p.observation.metrics,{followers:100});assert.doesNotMatch(JSON.stringify(p),/email|private/);
 assert.throws(()=>parseSavedPage('<p>999 followers</p>','facebook',name,when),/identity/);
});
test('conflicting canonical identity and count sources are rejected',()=>{
 assert.throws(()=>parseSavedPage(tik()+'<link rel="canonical" href="https://www.tiktok.com/@other">','tiktok',name,when),/identity/);
 const html=meta('instagram')+'<meta name="description" content="1 Followers, 2 Following, 3 Posts - bio"><meta property="og:description" content="2 Followers, 2 Following, 3 Posts - bio">';
 assert.throws(()=>parseSavedPage(html,'instagram',name,when),/conflicting_counters/);
 assert.throws(()=>parseSavedPage('<script>const x=`'+meta('instagram')+'`</script>','instagram',name,when),/identity/);
});
test('invalid, future and impossible dates, unsupported formats and oversized pages fail closed',()=>{
 for(const date of ['today','2026-09-01','2026-02-30T12:00:00Z','2100-01-01T12:00:00Z'])assert.throws(()=>parseSavedPage(tik(),'tiktok',name,date));
 assert.throws(()=>parseSavedPage('x'.repeat(PAGE_LIMIT+1),'tiktok',name,when),/payload_too_large/);
 assert.throws(()=>parseSavedPage('','github',name,when),/unsupported/);
 for(const invalid of [-1,1.5,'unknown','Infinity','9007199254740992'])assert.equal(parseSavedPage(tik({}, {followerCount:invalid}),'tiktok',name,when).observation.metrics.followers,undefined);
});
test('preview accepts other public identities but hosted publishing stays owner-only and dated',()=>{
 const p=parseSavedPage(tik(),'tiktok',name,when);assert.throws(()=>exportedProfile(p.observation),/unapproved_owner/);
 const owner=parseSavedPage(tik({uniqueId:owners.tiktok}),'tiktok',owners.tiktok,when);
 const published=exportedProfile(owner.observation);assert.equal(published.metrics.followers.source.kind,'owner_export');assert.equal(published.metrics.followers.observedAt,owner.observation.observedAt);assert.equal(published.metrics.followers.current,false);
});
test('local CLI defaults to preview and keeps network behind explicit publish flag',()=>{
 const tool=fileURLToPath(new URL('../tools/parse-page.mjs',import.meta.url)),fixture=fileURLToPath(new URL('./fixtures/synthetic-profile.html',import.meta.url));
 const args=['--import','data:text/javascript,globalThis.fetch=()=>{throw Error("unexpected_network")}',tool,fixture,'instagram',name,when];
 const preview=spawnSync(process.execPath,args,{encoding:'utf8',env:{...process.env,SOCIAL_POLLER_IMPORT_TOKEN:''}});
 assert.equal(preview.status,0,preview.stderr);assert.doesNotMatch(preview.stdout,/UNSELECTED|<html|access_token|unexpected_network/);
 assert.deepEqual(JSON.parse(preview.stdout).observation.metrics,{followers:1200,following:0,posts:42});
 const publish=spawnSync(process.execPath,[...args,'--publish'],{encoding:'utf8',env:{...process.env,SOCIAL_POLLER_IMPORT_TOKEN:''}});
 assert.equal(publish.status,1);assert.equal(publish.stderr.trim(),'unapproved_owner');assert.equal(publish.stdout,'');
});
