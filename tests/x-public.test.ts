import {test} from 'node:test';
import assert from 'node:assert/strict';
import {xPublicProfile} from '../src/x-public.ts';
import {owners,freshness,scheduledPlatforms} from '../src/model.ts';
const user={id:'1818144246383149056',screen_name:owners.x,protected:false,followers:12,following:0,statuses:33,email:'never-publish',description:'private-unneeded'};
const fetcher=(body:unknown,status=200):typeof fetch=>async(_url,options)=>{
 assert.equal(new Headers(options?.headers).get('authorization'),null);assert.equal(new Headers(options?.headers).get('cookie'),null);assert.equal(options?.redirect,'manual');
 return Response.json(body,{status});
};

test('enrolled X refresh cadence has headroom before its ten-minute freshness expiry',()=>{
 assert.deepEqual(scheduledPlatforms('*/5 * * * *'),['twitch','x']);
 assert.deepEqual(scheduledPlatforms('47 * * * *'),['github','bluesky','x']);
});
test('FxEmbed maps exact enrolled public counters with third-party attribution only',async()=>{
 const p=freshness(await xPublicProfile(owners.x,fetcher({code:200,user})));
 assert.equal(p.metrics.followers.value,12);assert.equal(p.metrics.following.value,0);assert.equal(p.metrics.posts.value,33);assert.equal(p.status,'current');
 assert.equal(p.metrics.followers.source.kind,'third_party_api');assert.doesNotMatch(JSON.stringify(p),/never-publish|private-unneeded|1818144246383149056/);
 await assert.rejects(xPublicProfile(owners.x,fetcher({code:200,user:{...user,id:'987'}})),/identity_mismatch/);
});
test('FxEmbed refuses unenrolled, mismatched, protected, and application-level error responses',async()=>{
 await assert.rejects(xPublicProfile('other',fetcher({code:200,user})),/connection_required/);
 await assert.rejects(xPublicProfile(owners.x,fetcher({code:200,user:{...user,screen_name:'other'}})),/identity_mismatch/);
 for(const p of [{...user,protected:true},{...user,protected:undefined}])await assert.rejects(xPublicProfile(owners.x,fetcher({code:200,user:p})),/profile_not_public/);
 for(const code of [403,404,410,429,500])await assert.rejects(xPublicProfile(owners.x,fetcher({code,user})),code===429?/upstream_limited/:code===500?/upstream_unavailable/:/profile_not_public/);
});
test('FxEmbed never turns rounded, absent, negative or unsafe counters into exact values',async()=>{
 const p=await xPublicProfile(owners.x,fetcher({code:200,user:{...user,followers:'4.6K',following:-1,statuses:Number.MAX_SAFE_INTEGER+1}}));
 assert.equal(Object.values(p.metrics).every(m=>m.value===null),true);
 await assert.rejects(xPublicProfile(owners.x,async()=>new Response('x'.repeat(262145),{headers:{'content-type':'application/json'}})),/payload_too_large/);
 await assert.rejects(xPublicProfile(owners.x,async()=>new Response('<html>challenge</html>',{headers:{'content-type':'text/html'}})),/upstream_unavailable/);
});
