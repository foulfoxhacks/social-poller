import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {ConnectionVault,seal,unseal,nonce,holdUntil,createState,consumeState,type Identity} from '../src/connection-vault.ts';
const owner:Identity={tenantId:'tenant_fixture_owner_0001',provider:'twitch',accountId:'12345678901234567890'};
const other:Identity={...owner,tenantId:'tenant_fixture_owner_0002'};
const now=Date.now(),secret=nonce(),tokens={accessToken:'unit-test-access-token-only',refreshToken:'unit-test-refresh-token-only',expiresAt:now+7200000,scopes:['moderator:read:followers']};
function database(){
 const raw=new DatabaseSync(':memory:');raw.exec(readFileSync(new URL('../connections/migrations/0001_connections.sql',import.meta.url),'utf8'));
 const prepare=(sql:string)=>{let args:any[]=[];return {bind(...v:any[]){args=v;return this;},async run(){return raw.prepare(sql).run(...args);},async first(){return raw.prepare(sql).get(...args)||null;}};};
 const db={prepare,async batch(statements:any[]){raw.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());raw.exec('COMMIT');return out;}catch(e){raw.exec('ROLLBACK');throw e;}}} as unknown as D1Database;
 return {db,raw,vault:new ConnectionVault(db,secret)};
}
test('token encryption is randomized, authenticated, tenant/account-bound and absent from plaintext storage',async()=>{
 const a=await seal(tokens,owner,secret,now),b=await seal(tokens,owner,secret,now);assert.notEqual(a,b);
 assert.doesNotMatch(a,/unit-test|accessToken|refreshToken/);assert.deepEqual(await unseal(a,owner,secret),tokens);
 await assert.rejects(unseal(a,other,secret));await assert.rejects(unseal(a,{...owner,accountId:'999'},secret));await assert.rejects(unseal(a,owner,nonce()));
 const tampered=JSON.parse(a);tampered.ciphertext=(tampered.ciphertext[0]==='A'?'B':'A')+tampered.ciphertext.slice(1);await assert.rejects(unseal(JSON.stringify(tampered),owner,secret));
 await assert.rejects(seal(tokens,owner,'short',now));await assert.rejects(seal({...tokens,expiresAt:now},owner,secret,now));
});
test('hold choices are bounded and honor a shorter provider deadline',()=>{
 for(const days of [1,7,30])assert.equal(holdUntil(days,now),now+days*86400000);
 for(const days of [0,2,365,-1,NaN,Infinity])assert.throws(()=>holdUntil(days,now));
 assert.equal(holdUntil(30,now,now+86400000),now+86400000);assert.throws(()=>holdUntil(1,now,now));
});
test('connection reads and publication are tenant-scoped and private until explicitly selected',async()=>{
 const {raw,vault}=database();await vault.save(owner,tokens,7,now);
 assert.equal(JSON.stringify(vault),'{}');
 assert.equal(await vault.read(other,now),null);const result=await vault.read(owner,now);assert.equal(result?.state,'authorized');if(result?.state==='authorized')assert.deepEqual(result.publicMetrics,[]);
 await vault.publish(other,['followers'],now);assert.equal(raw.prepare('SELECT public_metrics FROM creator_connections').get()!.public_metrics,'[]');
 await vault.publish(owner,['followers'],now);assert.equal(raw.prepare('SELECT public_metrics FROM creator_connections').get()!.public_metrics,'["followers"]');
 await assert.rejects(vault.publish(owner,['email'],now));await assert.rejects(vault.publish(owner,['followers','followers'],now));
 assert.doesNotMatch(JSON.stringify(raw.prepare('SELECT * FROM creator_connections').get()),/unit-test-access|unit-test-refresh/);
 await vault.save(owner,tokens,1,now);assert.equal(raw.prepare('SELECT public_metrics FROM creator_connections').get()!.public_metrics,'[]');raw.close();
});
test('expired access, overdue validation and elapsed hold periods never return usable tokens',async()=>{
 const {raw,vault}=database();await vault.save(owner,tokens,1,now);
 assert.deepEqual(await vault.read(owner,now+3600001),{state:'needs_validation'});
 assert.equal(await vault.read(owner,now+86400000),null);
 raw.prepare('UPDATE creator_connections SET access_expires_at=?').run(now);assert.deepEqual(await vault.read(owner,now),{state:'needs_validation'});raw.close();
});
test('disconnect and expiry purge cascade private metrics and preserve other tenants',async()=>{
 const {raw,vault}=database();await vault.save(owner,tokens,1,now);await vault.save(other,tokens,7,now);
 const add=(o:Identity)=>raw.prepare('INSERT INTO connection_metrics VALUES (?,?,?,?,?,?,?)').run(o.tenantId,o.provider,o.accountId,'followers',10,now,now+86400000);
 add(owner);add(other);await vault.disconnect(owner);assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM connection_metrics').get()!.n,1);
 assert.equal((await vault.read(other,now))?.state,'authorized');await vault.purge(now+86400000);assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM connection_metrics').get()!.n,0);
 await vault.purge(now+7*86400000);assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM creator_connections').get()!.n,0);raw.close();
});
test('OAuth state is hashed, browser-bound, ten-minute-lived and atomically single use',async()=>{
 const {raw,db,vault}=database(),browser=nonce();const state=await createState(db,browser,7,now);
 const rows=JSON.stringify(raw.prepare('SELECT * FROM oauth_states').all());assert.ok(!rows.includes(state)&&!rows.includes(browser));
 assert.equal(await consumeState(db,state,nonce(),now),null);
 const results=await Promise.all([consumeState(db,state,browser,now),consumeState(db,state,browser,now)]);assert.equal(results.filter(Boolean).length,1);assert.equal(results.find(Boolean)?.hold_days,7);
 const expired=await createState(db,browser,1,now);assert.equal(await consumeState(db,expired,browser,now+600000),null);await vault.purge(now+600000);assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM oauth_states').get()!.n,0);
 await assert.rejects(createState(db,'weak',7,now));await assert.rejects(createState(db,browser,365,now));raw.close();
});
