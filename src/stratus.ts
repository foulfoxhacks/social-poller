import {boundedText} from './providers.ts';
import {input,metricKeys,OWNER,freshness,type Profile} from './model.ts';
import {apiSchema} from './openapi.ts';
import {view,motionScript,chartSummaryCss} from './views.ts';
import type {History} from './history.ts';
import {creatorThemeCss} from './creator-theme.ts';
import {home,docs,connections,profilePage,layout,stratusCss,capabilities,STRATUS_ORIGIN} from './stratus-ui.ts';
const json=(body:unknown,status=200)=>Response.json(body,{status});
const html=(body:string,status=200)=>new Response(body,{status,headers:{'content-type':'text/html; charset=utf-8'}});
// This Worker has no import secret, database write binding or provider token.
// Only explicitly constructed public GET requests cross the service binding.
async function collect(env:StratusEnv,path:string):Promise<Response>{
 return env.COLLECTOR.fetch(new Request('https://social-poller.internal'+path,{method:'GET',signal:AbortSignal.timeout(12000)}));
}
async function data<T>(env:StratusEnv,path:string):Promise<T>{
 const response=await collect(env,path);
 if(!response.ok){await response.body?.cancel();throw Error(response.status===429?'rate_limited':'source_unavailable');}
 if(!response.headers.get('content-type')?.includes('application/json')){await response.body?.cancel();throw Error('source_unavailable');}
 return JSON.parse(await boundedText(response,1048576)) as T;
}
async function route(request:Request,env:StratusEnv):Promise<Response>{
 const url=new URL(request.url),path=url.pathname;
 if(!['GET','HEAD'].includes(request.method))return json({error:'method_not_allowed'},405);
 if(path==='/stratus-logo.png')return env.BRAND_ASSETS.fetch(new Request('https://assets.internal/stratus-logo.png'));
 if(path==='/favicon.ico')return new Response(null,{status:204});
 if(path==='/app.css')return new Response(chartSummaryCss+stratusCss+creatorThemeCss,{headers:{'content-type':'text/css; charset=utf-8'}});
 if(path==='/motion.js')return new Response(motionScript,{headers:{'content-type':'text/javascript; charset=utf-8'}});
 if(path==='/widget-refresh.js')return new Response("setInterval(()=>{if(!document.hidden)location.reload()},300000)",{headers:{'content-type':'text/javascript; charset=utf-8'}});
 if(path==='/health')return json({service:'stratus-social',version:'0.1.0',status:'ok',collector:'social-poller',mode:'read_only_beta'});
 if(path==='/robots.txt')return new Response(`User-agent: *\nAllow: /\nDisallow: /v1/\nDisallow: /widget\nSitemap: ${STRATUS_ORIGIN}/sitemap.xml\n`,{headers:{'content-type':'text/plain; charset=utf-8'}});
 if(path==='/sitemap.xml')return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/','/docs/','/status/'].map(p=>`<url><loc>${STRATUS_ORIGIN}${p}</loc></url>`).join('')}</urlset>`,{headers:{'content-type':'application/xml'}});
 if(['/docs','/status'].includes(path))return new Response(null,{status:308,headers:{location:path+'/'}});
 if(['/','/docs/','/status/'].includes(path)&&url.search&&(path!=='/'||!url.searchParams.has('username')))return new Response(null,{status:308,headers:{location:path}});
 if(path==='/docs/')return html(docs());
 if(path==='/status/')return html(connections());
 if(path==='/v1/platforms')return json({platforms:capabilities});
 if(path==='/openapi.json'){
  const schema=apiSchema();schema.info={...schema.info,title:'Stratus Social',version:'0.1.0',description:'Read-only public beta. No private analytics, OAuth enrollment or writes. YouTube is disabled.'};
  const paths=Object.fromEntries(Object.entries(schema.paths).filter(([p])=>['/v1/search','/v1/profiles/{platform}/{username}','/v1/history/{platform}/{username}','/v1/platforms'].includes(p)));
  return json({...schema,servers:[{url:STRATUS_ORIGIN}],paths,components:{}});
 }
 const parts=path.match(/^\/v1\/(profiles|history)\/([^/]+)\/([^/]+)$/);
 const isSearch=path==='/v1/search'||path==='/widget'||path==='/'&&url.searchParams.has('username');
 if(parts||isSearch){
  const target=input(parts?decodeURIComponent(parts[2]):url.searchParams.get('platform')||'',parts?decodeURIComponent(parts[3]):url.searchParams.get('username')||'');
  if(target.platform==='youtube')return path.startsWith('/v1/')?json({error:'provider_not_enabled',reason:'redistribution_review_required'},403):html(layout('Connection unavailable','<h1>YouTube is not enabled.</h1><p>Public API redistribution and storage need a separate provider review.</p><a href="/status/">View enabled connections</a>'),403);
  const mode=view(url.searchParams.get('view')),requestedMetric=url.searchParams.get('metric');
  let metric=requestedMetric||metricKeys(target.platform)[0]||'followers';
  const days=Number(url.searchParams.get('days')||7);
  if((parts?.[1]==='history'||mode==='graph')&&(!metricKeys(target.platform).includes(metric)||![7,30,90,365].includes(days)))throw Error('invalid_profile');
  const profilePath=`/v1/profiles/${target.platform}/${encodeURIComponent(target.username)}`;
  const historyPath=()=>`/v1/history/${target.platform}/${encodeURIComponent(target.username)}?metric=${encodeURIComponent(metric)}&days=${days}`;
  if(path.startsWith('/v1/'))return collect(env,parts?.[1]==='history'?historyPath():profilePath);
  const p=freshness(await data<Profile>(env,profilePath));
  if(p.platform!==target.platform||p.username!==target.username)throw Error('source_unavailable');
  if(!requestedMetric)metric=Object.entries(p.metrics).find(([,m])=>m.current&&m.value!==null)?.[0]||Object.entries(p.metrics).find(([,m])=>m.value!==null&&m.observedAt)?.[0]||metric;
  const trend=mode==='graph'?await data<History>(env,historyPath()):undefined;
  return html(profilePage(p,mode,trend,path==='/widget',path==='/widget'&&url.searchParams.get('theme')==='creator'));
 }
 if(path==='/'){
  let profiles:Profile[]=[];
  try{const bundle=await data<{profiles:Profile[]}>(env,`/v1/creators/${OWNER}`);profiles=bundle.profiles.map(p=>freshness(p));}catch{/* Search and docs remain available if examples cannot load. */}
  return html(home(profiles));
 }
 return json({error:'not_found'},404);
}
export default {
 async fetch(request,env):Promise<Response>{
  const url=new URL(request.url);let response:Response;
  try{
   if(request.method==='OPTIONS'&&url.pathname.startsWith('/v1/'))response=new Response(null,{status:204});
   else if((url.pathname.startsWith('/v1/')||url.pathname==='/widget'||url.searchParams.has('username'))&&!(await env.STRATUS_READ_LIMIT.limit({key:request.headers.get('CF-Connecting-IP')||'service-binding'})).success)response=json({error:'rate_limited'},429);
   else response=await route(request,env);
  }catch(error){const reason=error instanceof URIError?'invalid_profile':error instanceof Error?error.message:'';response=json({error:reason==='invalid_profile'?'invalid_profile':reason==='rate_limited'?'rate_limited':'source_unavailable'},reason==='invalid_profile'?400:reason==='rate_limited'?429:503);}
  const headers=new Headers(response.headers),indexable=['/','/docs/','/status/'].includes(url.pathname)&&!url.search&&response.status===200;
  headers.set('x-robots-tag',`${indexable?'index':'noindex'}, follow`);
  headers.set('x-content-type-options','nosniff');headers.set('referrer-policy','no-referrer');
  headers.set('content-security-policy',`default-src 'none'; connect-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors ${url.pathname==='/widget'?'*':"'none'"}`);
  headers.set('permissions-policy','camera=(), microphone=(), geolocation=()');
  headers.set('cache-control',response.status>=400?'no-store':'public, max-age=60, must-revalidate');
  if(url.pathname.startsWith('/v1/')){headers.set('access-control-allow-origin','*');headers.set('access-control-allow-methods','GET, HEAD, OPTIONS');}
  if(response.status===429)headers.set('retry-after','60');
  if(request.method==='HEAD')await response.body?.cancel();
  return new Response(request.method==='HEAD'?null:response.body,{status:response.status,headers});
 }
} satisfies ExportedHandler<StratusEnv>;
