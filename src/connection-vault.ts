// Staged OAuth storage primitive. Not wired to a public route or production DB.
// tenantId MUST come from a verified server session, never a caller parameter.
export type Provider='twitch';
export type Identity={tenantId:string;provider:Provider;accountId:string};
export type Grant={accessToken:string;refreshToken:string;expiresAt:number;scopes:string[]};
export const HOLD_DAYS=[1,7,30] as const;
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=(data:Uint8Array)=>btoa(String.fromCharCode(...data)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const bytes=(data:string)=>{if(!/^[A-Za-z0-9_-]+$/.test(data)||data.length>32768)throw Error('invalid_envelope');return Uint8Array.from(atob(data.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));};
export const nonce=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
export const hash=async(value:string)=>b64(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))));
function identity(value:Identity){
 if(!/^[A-Za-z0-9_-]{16,100}$/.test(value.tenantId)||value.provider!=='twitch'||!/^\d{1,30}$/.test(value.accountId))throw Error('invalid_identity');
 return JSON.stringify([value.tenantId,value.provider,value.accountId]);
}
function grant(value:Grant,now=Date.now()){
 if(!value||![value.accessToken,value.refreshToken].every(v=>typeof v==='string'&&/^[A-Za-z0-9._~-]{8,2048}$/.test(v))||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=now||value.expiresAt>now+366*86400000||!Array.isArray(value.scopes)||value.scopes.length>30||value.scopes.some(s=>typeof s!=='string'||!/^[a-z0-9:_-]{1,100}$/.test(s)))throw Error('invalid_grant');
 return value;
}
async function key(secret:string){const raw=bytes(secret);if(raw.length!==32)throw Error('invalid_encryption_key');return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function seal(value:Grant,owner:Identity,secret:string,now=Date.now()){
 grant(value,now);const iv=crypto.getRandomValues(new Uint8Array(12));
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(identity(owner))},await key(secret),enc.encode(JSON.stringify(value)));
 return JSON.stringify({version:1,iv:b64(iv),ciphertext:b64(new Uint8Array(cipher))});
}
export async function unseal(envelope:string,owner:Identity,secret:string):Promise<Grant>{
 if(envelope.length>24000)throw Error('invalid_envelope');const data=JSON.parse(envelope);
 if(data.version!==1||typeof data.iv!=='string'||typeof data.ciphertext!=='string')throw Error('invalid_envelope');
 const iv=bytes(data.iv);if(iv.length!==12)throw Error('invalid_envelope');
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode(identity(owner))},await key(secret),bytes(data.ciphertext));
 return JSON.parse(dec.decode(plain)) as Grant;
}
export function holdUntil(days:number,now=Date.now(),providerDeadline=Number.MAX_SAFE_INTEGER){
 if(!HOLD_DAYS.includes(days as typeof HOLD_DAYS[number])||!Number.isSafeInteger(now)||!Number.isSafeInteger(providerDeadline)||providerDeadline<=now)throw Error('invalid_retention');
 return Math.min(now+days*86400000,providerDeadline);
}
export type Stored={tenant_id:string;provider:Provider;account_id:string;token_envelope:string;hold_until:number;validated_at:number;access_expires_at:number;public_metrics:string};
export class ConnectionVault {
 #db:D1Database;
 #encryptionKey:string;
 constructor(db:D1Database,encryptionKey:string){this.#db=db;this.#encryptionKey=encryptionKey;}
 async save(owner:Identity,tokens:Grant,days:number,now=Date.now(),providerDeadline=Number.MAX_SAFE_INTEGER){
  const envelope=await seal(tokens,owner,this.#encryptionKey,now),until=holdUntil(days,now,providerDeadline);
  // Reauthorization never silently carries forward or grants public sharing.
  await this.#db.prepare(`INSERT INTO creator_connections (tenant_id,provider,account_id,token_envelope,hold_until,validated_at,access_expires_at,public_metrics)
    VALUES (?,?,?,?,?,?,?,'[]') ON CONFLICT(tenant_id,provider,account_id) DO UPDATE SET token_envelope=excluded.token_envelope,hold_until=excluded.hold_until,validated_at=excluded.validated_at,access_expires_at=excluded.access_expires_at,public_metrics='[]'`)
    .bind(owner.tenantId,owner.provider,owner.accountId,envelope,until,now,tokens.expiresAt).run();
  return {holdUntil:until,publicMetrics:[]};
 }
 async read(owner:Identity,now=Date.now()){
  identity(owner);
  const row=await this.#db.prepare('SELECT * FROM creator_connections WHERE tenant_id=? AND provider=? AND account_id=? AND hold_until>?').bind(owner.tenantId,owner.provider,owner.accountId,now).first<Stored>();
  if(!row)return null;
  // A stale validation or expired access token requires the refresh/validate
  // pipeline. Callers cannot continue using it for analytics through this read.
  if(now-row.validated_at>3600000||row.validated_at>now||row.access_expires_at<=now)return {state:'needs_validation' as const};
  return {state:'authorized' as const,tokens:await unseal(row.token_envelope,owner,this.#encryptionKey),holdUntil:row.hold_until,publicMetrics:JSON.parse(row.public_metrics) as string[]};
 }
 async publish(owner:Identity,metrics:string[],now=Date.now()){
  identity(owner);if(!Array.isArray(metrics)||metrics.length>2||new Set(metrics).size!==metrics.length||metrics.some(m=>!['followers','viewers'].includes(m)))throw Error('invalid_publication');
  await this.#db.prepare('UPDATE creator_connections SET public_metrics=? WHERE tenant_id=? AND provider=? AND account_id=? AND hold_until>?').bind(JSON.stringify(metrics),owner.tenantId,owner.provider,owner.accountId,now).run();
 }
 async disconnect(owner:Identity){
  identity(owner);
  // Foreign-key cascade removes private cached data. Upstream revocation must
  // be attempted by the account handler; local deletion is never contingent on it.
  await this.#db.prepare('DELETE FROM creator_connections WHERE tenant_id=? AND provider=? AND account_id=?').bind(owner.tenantId,owner.provider,owner.accountId).run();
 }
 async purge(now=Date.now()){
  await this.#db.batch([this.#db.prepare('DELETE FROM creator_connections WHERE hold_until<=?').bind(now),this.#db.prepare('DELETE FROM connection_metrics WHERE retain_until<=?').bind(now),this.#db.prepare('DELETE FROM oauth_states WHERE expires_at<=?').bind(now)]);
 }
}
export async function createState(db:D1Database,browserNonce:string,days:number,now=Date.now()){
 if(!/^[A-Za-z0-9_-]{43}$/.test(browserNonce))throw Error('invalid_browser_nonce');holdUntil(days,now);
 const state=nonce();await db.prepare('INSERT INTO oauth_states (state_hash,browser_hash,hold_days,expires_at) VALUES (?,?,?,?)').bind(await hash(state),await hash(browserNonce),days,now+600000).run();return state;
}
export async function consumeState(db:D1Database,state:string,browserNonce:string,now=Date.now()){
 if(![state,browserNonce].every(v=>/^[A-Za-z0-9_-]{43}$/.test(v)))return null;
 // A single atomic statement binds the response to this browser and defeats replay.
 return db.prepare('DELETE FROM oauth_states WHERE state_hash=? AND browser_hash=? AND expires_at>? RETURNING hold_days').bind(await hash(state),await hash(browserNonce),now).first<{hold_days:number}>();
}
