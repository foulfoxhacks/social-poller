import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {tiktokHandoff,TIKTOK_CALLBACK,TIKTOK_CLIENT_KEY,TIKTOK_SCOPES,purgeHandoffs} from '../src/tiktok-handoff.ts';
import worker from '../src/stratus.ts';
import {nonce} from '../src/connection-vault.ts';
const at=Date.now(),origin=new URL(TIKTOK_CALLBACK).origin;
const pair=await crypto.subtle.generateKey({name:'RSA-OAEP',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['encrypt','decrypt']);
const publicKey=await crypto.subtle.exportKey('jwk',pair.publicKey);
function setup(){
 const raw=new DatabaseSync(':memory:');raw.exec(readFileSync(new URL('../oauth/migrations/0001_handoffs.sql',import.meta.url),'utf8'));
 const db={prepare(sql:string){let args:any[]=[];return {bind(...v:any[]){args=v;return this;},async run(){return raw.prepare(sql).run(...args);},async first(){return raw.prepare(sql).get(...args)||null;}};}} as unknown as D1Database;
 const req=(path:string,init?:RequestInit,now=at)=>tiktokHandoff(new Request(origin+path,init),db,now);
 const prepare=async()=>await (await req('/auth/tiktok/prepare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({publicKey})})).json() as any;
 return {db,raw,req,prepare};
}
test('complete handoff is browser-bound, encrypted to the operator and retrieved once',async()=>{
 const {raw,req,prepare}=setup(),p=await prepare();
 assert.equal(p.clientKey,TIKTOK_CLIENT_KEY);assert.equal(p.redirectUri,TIKTOK_CALLBACK);
 assert.doesNotMatch(JSON.stringify(raw.prepare('SELECT * FROM oauth_handoffs').all()),new RegExp(p.pollToken));
 const start=await req(new URL(p.authorizeUrl).pathname),authorize=new URL(start.headers.get('location')!);
 assert.equal(authorize.origin,'https://www.tiktok.com');assert.equal(authorize.searchParams.get('scope'),TIKTOK_SCOPES.join(','));assert.equal(authorize.searchParams.get('redirect_uri'),TIKTOK_CALLBACK);
 const cookie=start.headers.get('set-cookie')!;assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);
 const callback='/auth/tiktok/callback?state='+authorize.searchParams.get('state')+'&code=PRIVATE_AUTHORIZATION_CODE';
 assert.equal((await req(callback)).status,400);assert.equal((await req(callback,{headers:{cookie:'__Host-stratus-tiktok='+nonce()}})).status,400);
 const done=await req(callback,{headers:{cookie}});assert.equal(done.status,303);assert.equal(done.headers.get('location'),'/auth/tiktok/received');assert.equal(await done.text(),'');
 assert.equal((await req(callback,{headers:{cookie}})).status,400);
 assert.doesNotMatch(JSON.stringify(raw.prepare('SELECT * FROM oauth_handoffs').all()),/PRIVATE_AUTHORIZATION_CODE/);
 const path=new URL(p.pollUrl).pathname;assert.equal((await req(path)).status,404);
 const response=await req(path,{headers:{authorization:'Bearer '+p.pollToken}}),out=await response.json() as any;
 const key=await crypto.subtle.decrypt('RSA-OAEP',pair.privateKey,Buffer.from(out.encrypted.key,'base64'));
 const aes=await crypto.subtle.importKey('raw',key,'AES-GCM',false,['decrypt']);
 const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(out.encrypted.iv,'base64'),additionalData:new TextEncoder().encode(path.split('/').at(-1)!)},aes,Buffer.from(out.encrypted.ciphertext,'base64'));
 assert.deepEqual(JSON.parse(new TextDecoder().decode(plaintext)),{code:'PRIVATE_AUTHORIZATION_CODE'});
 assert.equal((await req(path,{headers:{authorization:'Bearer '+p.pollToken}})).status,404);assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM oauth_handoffs').get()!.n,0);raw.close();
});
test('handoff rejects private keys and cross-origin prepare; expiry never returns a usable result',async()=>{
 const {raw,req,prepare,db}=setup();
 for(const key of [{...publicKey,d:'private'},{}])assert.equal((await req('/auth/tiktok/prepare',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({publicKey:key})})).status,400);
 assert.equal((await req('/auth/tiktok/prepare',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify({publicKey})})).status,400);
 assert.equal((await req('/auth/tiktok/prepare',{method:'POST',headers:{'content-type':'application/json'},body:'null'})).status,400);
 assert.equal((await req('/auth/tiktok/prepare',{method:'POST',headers:{'content-type':'application/json'},body:'{'})).status,400);
 assert.equal((await req('/auth/tiktok/received',{method:'POST'})).status,405);
 assert.equal((await req('/auth/tiktok/prepare',{method:'HEAD'})).status,405);
 assert.equal((await req('/auth/tiktok/missing')).status,404);
 const p=await prepare(),path=new URL(p.pollUrl).pathname;
 assert.equal((await req(path,{headers:{authorization:'Bearer '+p.pollToken}})).status,202);
 assert.equal((await req(new URL(p.authorizeUrl).pathname,undefined,at+900001)).status,400);
 assert.equal((await req(path,{headers:{authorization:'Bearer '+p.pollToken}},at+900001)).status,404);
 await purgeHandoffs(db,at+900001);assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM oauth_handoffs').get()!.n,0);raw.close();
});
test('auth routes are uncached, non-indexed, without CORS, and never echo supplied credentials',async()=>{
 const {raw,db}=setup();const env={OAUTH_HANDOFFS:db,STRATUS_READ_LIMIT:{limit:async()=>({success:true})}} as unknown as StratusEnv;
 for(const path of ['/auth/tiktok/callback','/auth/tiktok/callback?code=PRIVATE_TOKEN&state=untrusted']){
  const r=await worker.fetch(new Request(origin+path),env,{} as ExecutionContext);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-robots-tag'),'noindex, follow');assert.equal(r.headers.get('access-control-allow-origin'),null);assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.doesNotMatch(await r.text(),/PRIVATE_TOKEN|untrusted/);
 }
 const head=await worker.fetch(new Request(TIKTOK_CALLBACK,{method:'HEAD'}),env,{} as ExecutionContext);assert.equal(await head.text(),'');raw.close();
});
