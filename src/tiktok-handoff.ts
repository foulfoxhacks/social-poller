import {boundedText} from './providers.ts';
import {hash,nonce} from './connection-vault.ts';

export const TIKTOK_CALLBACK='https://stratus-social.kc3wca.workers.dev/auth/tiktok/callback';
export const TIKTOK_CLIENT_KEY='sbaw8odgof2gonlx23'; // Public sandbox identifier supplied by the owner.
export const TIKTOK_SCOPES=['user.info.basic','user.info.profile','user.info.stats','video.list'];
const ORIGIN=new URL(TIKTOK_CALLBACK).origin,TTL=15*60*1000;
const valid=(s:string)=>/^[A-Za-z0-9_-]{43}$/.test(s);
const enc=new TextEncoder();
const b64=(v:Uint8Array)=>btoa(String.fromCharCode(...v));
const json=(v:unknown,status=200)=>Response.json(v,{status});
type Row={id:string;poll_hash:string;public_key:string;expires_at:number;phase:string;state_hash:string;browser_hash:string;result:string|null};
const html=(message:string,status=200)=>new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, follow"><title>TikTok connection | Stratus Social</title><link rel="stylesheet" href="/app.css"><main class="shell"><h1>TikTok connection</h1><p>${message}</p><p>The registered callback is <code>${TIKTOK_CALLBACK}</code>.</p><p>This owner-only setup does not publish posts or grant access to other creators.</p><a href="https://akasammythepuppy.me/media-kit/">Return to the media kit</a></main></html>`,{status,headers:{'content-type':'text/html; charset=utf-8'}});
export async function encryptHandoff(publicKey:JsonWebKey,ticket:string,result:unknown){
 const rsa=await crypto.subtle.importKey('jwk',publicKey,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
 const rawKey=crypto.getRandomValues(new Uint8Array(32)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await crypto.subtle.importKey('raw',rawKey,'AES-GCM',false,['encrypt']);
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(ticket)},key,enc.encode(JSON.stringify(result)));
 const wrapped=await crypto.subtle.encrypt('RSA-OAEP',rsa,rawKey);
 return JSON.stringify({version:1,iv:b64(iv),key:b64(new Uint8Array(wrapped)),ciphertext:b64(new Uint8Array(ciphertext))});
}
export async function purgeHandoffs(db:D1Database,now=Date.now()){
 await db.prepare('DELETE FROM oauth_handoffs WHERE expires_at<=?').bind(now).run();
}
export async function tiktokHandoff(request:Request,db:D1Database,now=Date.now()):Promise<Response>{
 const u=new URL(request.url),path=u.pathname;
 if(request.method==='HEAD'&&path==='/auth/tiktok/callback')return html('Callback registered. Start the operator-assisted consent flow to connect the account.');
 if(request.method!==(path==='/auth/tiktok/prepare'?'POST':'GET'))return json({error:'method_not_allowed'},405);
 if(path==='/auth/tiktok/prepare'){
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  // Preparation is a CLI operation, not a cross-origin browser API.
  if(request.headers.has('origin')||request.headers.get('content-type')!=='application/json')return json({error:'invalid_request'},400);
  let body;try{body=JSON.parse(await boundedText(new Response(request.body),4096));}catch{return json({error:'invalid_request'},400);}
  const jwk=body?.publicKey;
  if(!jwk||jwk.kty!=='RSA'||jwk.e!=='AQAB'||typeof jwk.n!=='string'||!/^[-_A-Za-z0-9]{342,683}$/.test(jwk.n)||Object.keys(jwk).some(k=>!['kty','n','e','alg','ext','key_ops'].includes(k)))return json({error:'invalid_public_key'},400);
  const publicKey={kty:'RSA',n:jwk.n,e:jwk.e,alg:'RSA-OAEP-256',ext:true,key_ops:['encrypt']};
  try{
   const key=await crypto.subtle.importKey('jwk',publicKey,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
   if(![2048,3072,4096].includes((key.algorithm as {modulusLength:number}).modulusLength))return json({error:'invalid_public_key'},400);
  }catch{return json({error:'invalid_public_key'},400);}
  const ticket=nonce(),pollToken=nonce();
  const inserted=await db.prepare("INSERT INTO oauth_handoffs (id,poll_hash,public_key,expires_at,phase) SELECT ?,?,?,?,'pending' WHERE (SELECT COUNT(*) FROM oauth_handoffs WHERE expires_at>?)<50 RETURNING id")
   .bind(ticket,await hash(pollToken),JSON.stringify(publicKey),now+TTL,now).first();
  if(!inserted)return json({error:'setup_capacity_reached'},429);
  return json({authorizeUrl:`${ORIGIN}/auth/tiktok/connect/${ticket}`,pollUrl:`${ORIGIN}/auth/tiktok/result/${ticket}`,pollToken,expiresAt:now+TTL,clientKey:TIKTOK_CLIENT_KEY,redirectUri:TIKTOK_CALLBACK,scopes:TIKTOK_SCOPES});
 }
 const start=path.match(/^\/auth\/tiktok\/connect\/([A-Za-z0-9_-]{43})$/);
 if(start){
  if(request.method!=='GET')return json({error:'method_not_allowed'},405);
  if(u.origin!==ORIGIN)return new Response(null,{status:303,headers:{location:ORIGIN+path}});
  const state=nonce(),browser=nonce();
  const row=await db.prepare("UPDATE oauth_handoffs SET phase='authorizing',state_hash=?,browser_hash=? WHERE id=? AND phase='pending' AND expires_at>? RETURNING id")
   .bind(await hash(state),await hash(browser),start[1],now).first();
  if(!row)return html('This setup link has expired or has already been opened. Start a new connection attempt.',400);
  const url=new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.search=new URLSearchParams({client_key:TIKTOK_CLIENT_KEY,scope:TIKTOK_SCOPES.join(','),response_type:'code',redirect_uri:TIKTOK_CALLBACK,state,disable_auto_auth:'1'}).toString();
  return new Response(null,{status:303,headers:{location:url.href,'set-cookie':`__Host-stratus-tiktok=${browser}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=900`}});
 }
 if(path==='/auth/tiktok/callback'){
  if(request.method!=='GET')return json({error:'method_not_allowed'},405);
  if(!u.search)return html('The callback is ready. Start the operator-assisted connection flow, then approve the four read-only TikTok scopes.');
  const state=u.searchParams.get('state')||'',browser=request.headers.get('cookie')?.match(/(?:^|;\s*)__Host-stratus-tiktok=([A-Za-z0-9_-]{43})(?:;|$)/)?.[1]||'';
  if(u.origin!==ORIGIN||!valid(state)||!valid(browser))return html('The connection could not be verified. Start a new connection attempt.',400);
  const row=await db.prepare("SELECT * FROM oauth_handoffs WHERE state_hash=? AND browser_hash=? AND phase='authorizing' AND expires_at>?").bind(await hash(state),await hash(browser),now).first<Row>();
  if(!row)return html('This connection has expired or has already been completed.',400);
  const code=u.searchParams.get('code')||'';
  const result=u.searchParams.has('error')?{error:'consent_not_granted'}:code.length>0&&code.length<=2048&&!/[\r\n\x00]/.test(code)?{code}:{error:'invalid_authorization_response'};
  const encrypted=await encryptHandoff(JSON.parse(row.public_key),row.id,result);
  const accepted=await db.prepare("UPDATE oauth_handoffs SET phase='ready',result=? WHERE id=? AND phase='authorizing' AND expires_at>? RETURNING id").bind(encrypted,row.id,now).first();
  if(!accepted)return html('This connection has expired or has already been completed.',400);
  // Clean the address bar before loading any CSS or navigation.
  return new Response(null,{status:303,headers:{location:'/auth/tiktok/received','set-cookie':'__Host-stratus-tiktok=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}});
 }
 if(path==='/auth/tiktok/received')return html('The authorization response was handed back securely. Keep the operator connection process open while it verifies the account and publishes the new grant. This page alone does not confirm metrics are connected.');
 const poll=path.match(/^\/auth\/tiktok\/result\/([A-Za-z0-9_-]{43})$/);
 if(poll){
  if(request.method!=='GET')return json({error:'method_not_allowed'},405);
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
  if(!valid(token))return json({error:'not_found'},404);
  const digest=await hash(token);
  const row=await db.prepare('SELECT phase FROM oauth_handoffs WHERE id=? AND poll_hash=? AND expires_at>?').bind(poll[1],digest,now).first<{phase:string}>();
  if(!row)return json({error:'not_found'},404);
  if(row.phase!=='ready')return json({status:'awaiting_consent'},202);
  const once=await db.prepare("DELETE FROM oauth_handoffs WHERE id=? AND poll_hash=? AND phase='ready' AND expires_at>? RETURNING result").bind(poll[1],digest,now).first<{result:string}>();
  return once?json({encrypted:JSON.parse(once.result)}):json({error:'already_received'},410);
 }
 return json({error:'not_found'},404);
}
