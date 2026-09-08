import {apiSchema} from './openapi.ts';
import {timingSafeEqual} from 'node:crypto';
import {fields,names,owners,OWNER,empty,freshness,fromLegacy,toLegacy,exportedProfile,input,object,metricKeys,PUBLIC_PROVIDERS,refreshInterval} from './model.ts';
import {boundedText} from './providers.ts';
import {creator,saveCreator,saveExport,lookup} from './service.ts';
import {page,css,embedScript} from './ui.ts';
import {creatorThemeCss} from './creator-theme.ts';
import {view,viewCss,motionScript,chartSummaryCss} from './views.ts';
import {history,record,prune} from './history.ts';

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8'}});
async function authenticated(request:Request,token:string):Promise<boolean>{
 if(!token||token.length<32)return false;
 const provided=(request.headers.get('authorization')||'').replace(/^Bearer /,'');
 const encode=new TextEncoder();const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',encode.encode(provided)),crypto.subtle.digest('SHA-256',encode.encode(token))]);
 return timingSafeEqual(new Uint8Array(a),new Uint8Array(b));
}
async function route(request:Request,env:Env):Promise<Response>{
 const u=new URL(request.url);
 if(u.pathname.startsWith('/v1/import/')){
  if(request.method!=='POST')return json({error:'method_not_allowed'},405);
  if(!await authenticated(request,env.IMPORT_TOKEN))return json({error:'unauthorized'},401);
  if(!(request.headers.get('content-type')||'').startsWith('application/json'))return json({error:'json_required'},415);
  const data:unknown=JSON.parse(await boundedText(new Response(request.body,{headers:request.headers}),65536));
  if(u.pathname==='/v1/import/export') {
    const observations=object(data).observations;
    if(!Array.isArray(observations)||!observations.length||observations.length>10)throw Error('invalid_export');
    // Validate the entire batch before any write; retries deduplicate history.
    const exports=observations.map(exportedProfile);
    for(const profile of exports)await saveExport(env,profile);
    return json({accepted:exports.length});
  }
  const profiles=u.pathname==='/v1/import/media-kit'?fromLegacy(data):u.pathname==='/v1/import/profile'?[exportedProfile(data)]:null;
  if(!profiles)return json({error:'not_found'},404);
  if(u.pathname.endsWith('/profile'))await saveExport(env,profiles[0]);else await saveCreator(env,profiles);
  console.log(JSON.stringify({event:'aggregate_import',profiles:profiles.length,kind:u.pathname.endsWith('/profile')?'owner_export':'authorized_api'}));
  return json({accepted:profiles.length});
 }
 if(!['GET','HEAD'].includes(request.method))return json({error:'method_not_allowed'},405);
 if(u.pathname==='/health')return json({service:'social-poller',version:'0.2.0',status:'ok'});
 if(u.pathname==='/favicon.ico')return new Response(null,{status:204});
 if(u.pathname==='/robots.txt')return new Response('User-agent: *\nDisallow: /v1/\nDisallow: /widget\n',{headers:{'content-type':'text/plain; charset=utf-8'}});
 if(u.pathname==='/app.css')return new Response(css+viewCss+chartSummaryCss+creatorThemeCss,{headers:{'content-type':'text/css; charset=utf-8'}});
 if(u.pathname==='/motion.js')return new Response(motionScript,{headers:{'content-type':'text/javascript; charset=utf-8'}});
 if(u.pathname==='/embed.js')return new Response(embedScript,{headers:{'content-type':'text/javascript; charset=utf-8'}});
 if(u.pathname==='/widget-refresh.js')return new Response("(()=>{const refresh=()=>{if(!document.hidden)location.reload();};setInterval(refresh,300000);})();",{headers:{'content-type':'text/javascript; charset=utf-8'}});
 if(u.pathname==='/v1/platforms')return json({platforms:Object.entries(fields).map(([id,metrics])=>({id,name:names[id],metrics,lookup:id==='twitch'?'third_party_api':PUBLIC_PROVIDERS.includes(id)?'public_api':metrics.length?'connected_snapshot_or_owner_export':'profile_only',refreshIntervalSeconds:PUBLIC_PROVIDERS.includes(id)?refreshInterval(id)/1000:null,scraping:false}))});
 if(u.pathname==='/openapi.json')return json(apiSchema());
 if(u.pathname===`/v1/media-kit/${OWNER}`){const saved=await creator(env);return saved.length?json(toLegacy(saved)):json({error:'snapshot_not_ready'},503);}
 if(u.pathname===`/v1/creators/${OWNER}`){const saved=await creator(env);return json({schemaVersion:1,creator:OWNER,profiles:Object.entries(owners).map(([id,name])=>freshness(saved.find(p=>p.platform===id&&p.username===name)||empty(id,name))),note:'Known official accounts only. Audience sums are not unique people.'});}
 let target:{platform:string;username:string}|undefined;
 const parts=u.pathname.match(/^\/v1\/(?:profiles|history)\/([^/]+)\/([^/]+)$/);
 if(parts)target=input(decodeURIComponent(parts[1]),decodeURIComponent(parts[2]));
 else if(['/v1/search','/widget'].includes(u.pathname)||u.pathname==='/'&&u.searchParams.has('username'))target=input(u.searchParams.get('platform')||'',u.searchParams.get('username')||'');
 if(target){
  const mode=view(u.searchParams.get('view'));
  const requestedMetric=u.searchParams.get('metric')||fields[target.platform][0]||'followers';
  const metric=!u.pathname.startsWith('/v1/')&&!metricKeys(target.platform).includes(requestedMetric)?fields[target.platform][0]||'followers':requestedMetric;
  const days=Number(u.searchParams.get('days')||30);
  const wantsHistory=u.pathname.startsWith('/v1/history/')||mode==='graph';
  if(wantsHistory&&(!metricKeys(target.platform).includes(metric)||![7,30,90,365].includes(days)))throw Error('invalid_history_query');
  if(u.pathname.startsWith('/v1/history/'))return json(await history(env,target.platform,target.username,metric,days));
  const profile=await lookup(env,target.platform,target.username);
  const trend=wantsHistory?await history(env,target.platform,target.username,metric,days):undefined;
  return u.pathname.startsWith('/v1/')?json(profile):new Response(page(u.origin,profile,undefined,u.pathname==='/widget',mode,trend,u.pathname==='/widget'&&u.searchParams.get('theme')==='creator'),{headers:{'content-type':'text/html; charset=utf-8'}});
 }
 if(u.pathname==='/')return new Response(page(u.origin),{headers:{'content-type':'text/html; charset=utf-8'}});
 return json({error:'not_found'},404);
}
export default {
 async fetch(request,env):Promise<Response>{
  const url=new URL(request.url);let response:Response;
  try{
   if(request.method==='OPTIONS')response=new Response(null,{status:204});
   else if(!(await env.READ_LIMIT.limit({key:request.headers.get('CF-Connecting-IP')||'service-binding'})).success)response=json({error:'rate_limited'},429);
   else response=await route(request,env);
  }catch(error){
   const reason=error instanceof Error?error.message:'';
   const errors=['invalid_profile','invalid_snapshot','unapproved_owner','invalid_metric','invalid_observation_date','empty_export','payload_too_large','older_snapshot','invalid_export','invalid_reporting_period','invalid_history_query'];
   response=json({error:errors.includes(reason)?reason:error instanceof SyntaxError?'invalid_json':'service_unavailable'},errors.includes(reason)||error instanceof SyntaxError?400:503);
  }
  const headers=new Headers(response.headers);
  headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','no-referrer');headers.set('x-robots-tag','noindex, follow');
  headers.set('content-security-policy',`default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors ${url.pathname==='/widget'?'*':"'self'"}`);
  headers.set('permissions-policy','camera=(), microphone=(), geolocation=()');
  headers.set('cache-control',url.pathname.startsWith('/v1/import/')||response.status>=400?'no-store':'public, max-age=60, must-revalidate');
  if(url.pathname.startsWith('/v1/')&&!url.pathname.startsWith('/v1/import/')){headers.set('access-control-allow-origin','*');headers.set('access-control-allow-methods','GET, HEAD, OPTIONS');}
  if(response.status===429)headers.set('retry-after','60');
  if(request.method==='HEAD')await response.body?.cancel();
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
 },
 async scheduled(event,env){
  const platforms=event.cron==='*/5 * * * *'?['twitch',...(new Date(event.scheduledTime).getUTCMinutes()%10===0?['x']:[])]:['github','bluesky','x'];
  for(const platform of platforms)await lookup(env,platform,owners[platform],true);
  if(event.cron!=='*/5 * * * *'){await record(env,await creator(env));await prune(env);}
  console.log(JSON.stringify({event:'scheduled_refresh',providers:platforms}));
 }
} satisfies ExportedHandler<Env>;
