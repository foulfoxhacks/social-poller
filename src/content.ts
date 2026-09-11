import {object,owners,input,profileUrl,count} from './model.ts';

export const CONTENT_FIELDS:Record<string,string[]>={tiktok:['views','likes','comments','shares'],instagram:['likes','comments'],youtube:['views','likes','comments'],twitch:['views'],bluesky:['likes','comments','reposts','quotes'],x:['likes','comments','reposts','quotes'],github:['stars','forks'],facebook:['reactions','comments','shares'],reddit:['score','comments'],kick:['viewers']};
const interactions:Record<string,string[]>={tiktok:['likes','comments','shares'],instagram:['likes','comments'],bluesky:['likes','comments','reposts','quotes'],x:['likes','comments','reposts','quotes'],facebook:['reactions','comments','shares']};
export type ContentPost={id:string;url:string;title:string;publishedAt:string|null;metrics:Record<string,number|null>};
export type ContentSnapshot={version:1;platform:string;username:string;observedAt:string;source:{kind:string;url:string};coverage:'recent_sample';posts:ContentPost[]};
const stamp=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.now()+60000?new Date(value).toISOString():null;
const value=(platform:string,k:string,v:unknown):number|null=>typeof v==='number'&&Number.isSafeInteger(v)&&(v>=0||platform==='reddit'&&k==='score')?v:null;
const contentPostCompare=(a:ContentPost,b:ContentPost)=>{
 const aTime=a.publishedAt?Date.parse(a.publishedAt):-Infinity,bTime=b.publishedAt?Date.parse(b.publishedAt):-Infinity;
 return bTime-aTime||a.id.localeCompare(b.id)||a.url.localeCompare(b.url);
};
const sameSnapshot=(a:ContentSnapshot,b:ContentSnapshot)=>JSON.stringify(a)===JSON.stringify(b);
function ownerBoundUrl(platform:string,username:string,url:URL):boolean {
 const path=decodeURIComponent(url.pathname).replace(/\/$/,'');
 if(platform==='tiktok')return new RegExp(`^/@${username.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}/video/\\d+$`,'i').test(path);
 if(platform==='bluesky')return path.toLowerCase().startsWith(`/profile/${username.toLowerCase()}/post/`);
 if(platform==='x')return path.toLowerCase().startsWith(`/${username.toLowerCase()}/status/`);
 if(platform==='github')return path.toLowerCase()===`/${username.toLowerCase()}`||path.toLowerCase().startsWith(`/${username.toLowerCase()}/`);
 return true;
}
export function normalizeContent(raw:unknown):ContentSnapshot {
 const data=object(raw),target=input(String(data.platform||''),String(data.username||''));
 if(owners[target.platform]!==target.username||!CONTENT_FIELDS[target.platform])throw Error('unapproved_owner');
 const observedAt=stamp(data.observedAt),source=object(data.source);
 if(data.version!==1||data.coverage!=='recent_sample'||!observedAt||Date.now()-Date.parse(observedAt)>86280000)throw Error('invalid_content');
 if(!['public_api','authorized_api','third_party_api'].includes(String(source.kind))||source.url!==profileUrl(target.platform,target.username))throw Error('invalid_content');
 if(!Array.isArray(data.posts)||data.posts.length>20)throw Error('invalid_content');
 const ids=new Set<string>();
 const posts=data.posts.map(item=>{
  const p=object(item),id=String(p.id||'');let url:URL;try{url=new URL(String(p.url));}catch{throw Error('invalid_content');}
  const hosts:Record<string,string[]>={tiktok:['www.tiktok.com'],instagram:['www.instagram.com'],youtube:['www.youtube.com'],twitch:['www.twitch.tv','clips.twitch.tv'],bluesky:['bsky.app'],x:['x.com'],github:['github.com'],facebook:['www.facebook.com'],reddit:['www.reddit.com'],kick:['kick.com']};
  if(!/^[\w.:-]{1,160}$/.test(id)||ids.has(id)||url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!hosts[target.platform].includes(url.hostname)||url.href.length>512||!ownerBoundUrl(target.platform,target.username,url))throw Error('invalid_content');
  if(url.search&&(target.platform!=='youtube'||url.pathname!=='/watch'||[...url.searchParams.keys()].some(k=>k!=='v')))throw Error('invalid_content');
  ids.add(id);const metrics=object(p.metrics),title=typeof p.title==='string'?p.title.replace(/[\x00-\x1f]/g,' ').trim():'',publishedAt=stamp(p.publishedAt);
  if(!title||title.length>200||Object.entries(metrics).some(([k,v])=>!CONTENT_FIELDS[target.platform].includes(k)||v!==null&&value(target.platform,k,v)===null))throw Error('invalid_content');
  if(p.publishedAt!==null&&p.publishedAt!==undefined&&!publishedAt||publishedAt&&Date.parse(publishedAt)>Date.parse(observedAt)+60000)throw Error('invalid_content');
  return {id,url:url.href,title,publishedAt,metrics:Object.fromEntries(CONTENT_FIELDS[target.platform].map(k=>[k,value(target.platform,k,metrics[k])]))};
 }).sort(contentPostCompare);
 return {version:1,...target,observedAt,source:{kind:String(source.kind),url:String(source.url)},coverage:'recent_sample',posts};
}
const key=(platform:string,username:string)=>`content:${platform}:${username}`;
type Saved={latest:ContentSnapshot;previous:ContentSnapshot|null};
const compatiblePrevious=(candidate:ContentSnapshot|null|undefined,next:ContentSnapshot)=>Boolean(candidate&&next.source.kind===candidate.source.kind&&next.source.url===candidate.source.url&&Date.parse(candidate.observedAt)<Date.parse(next.observedAt)&&Date.now()-Date.parse(candidate.observedAt)<86280000);
export async function saveContent(env:Env,raw:unknown):Promise<number> {
 const next=normalizeContent(raw),k=key(next.platform,next.username),old=await env.SNAPSHOTS.get<Saved>(k,'json');
 if(old&&Date.parse(old.latest.observedAt)>Date.parse(next.observedAt))throw Error('older_snapshot');
 if(old?.latest.observedAt===next.observedAt&&sameSnapshot(old.latest,next))return next.posts.length;
 let previous:ContentSnapshot|null=null;
 if(old?.latest.observedAt===next.observedAt) {
  // A collector can correct a payload without advancing its observation clock.
  // Replace the latest payload, but never manufacture a zero-duration trend.
  previous=compatiblePrevious(old.previous,next)?old.previous:null;
 } else if(old&&compatiblePrevious(old.latest,next)) {
  // Only two bounded samples; replacing rather than merging removes absent posts.
  previous={...old.latest,posts:old.latest.posts.filter(p=>next.posts.some(q=>q.id===p.id&&q.url===p.url))};
 }
 // Expire both at the older observation's deadline: refreshing latest must
 // not extend the previous record beyond its own 24-hour retention period.
 const expiration=Math.floor((Date.parse(previous?.observedAt||next.observedAt)+86400000)/1000);
 await env.SNAPSHOTS.put(k,JSON.stringify({latest:next,previous}),{expiration});
 return next.posts.length;
}
export async function withdrawContent(env:Env,platform:string,username:string):Promise<void>{
 if(owners[platform]!==username||!CONTENT_FIELDS[platform])throw Error('unapproved_owner');
 await env.SNAPSHOTS.delete(key(platform,username));
}
function engagement(platform:string,p:ContentPost):number|null {
 const keys=interactions[platform];if(!keys||keys.some(k=>p.metrics[k]===null||p.metrics[k]===undefined))return null;
 const total=keys.reduce((sum,k)=>sum+(p.metrics[k]||0),0);return Number.isSafeInteger(total)?total:null;
}
export async function content(env:Env,platform:string,username:string,now=Date.now()) {
 if(owners[platform]!==username||!CONTENT_FIELDS[platform])return {version:1,platform,username,status:'connection_required',posts:[]};
 const saved=await env.SNAPSHOTS.get<Saved>(key(platform,username),'json');
 if(!saved||now-Date.parse(saved.latest.observedAt)>86400000)return {version:1,platform,username,status:'connection_required',posts:[]};
 const {latest,previous}=saved,current=now-Date.parse(latest.observedAt)<=6*3600000;
 const posts=latest.posts.map(p=>{
  const before=previous?.posts.find(q=>q.id===p.id&&q.url===p.url),total=engagement(platform,p),old=before?engagement(platform,before):null;
  const canCompare=current&&platform!=='youtube'&&before&&previous&&Date.parse(latest.observedAt)>Date.parse(previous.observedAt);
  return {...p,interactions:total,change:canCompare?{since:previous.observedAt,views:p.metrics.views!==null&&p.metrics.views!==undefined&&before.metrics.views!==null&&before.metrics.views!==undefined?p.metrics.views-before.metrics.views:null,interactions:total!==null&&old!==null?total-old:null}:null};
 });
 return {...latest,status:current?'current':'stale',sampleSize:posts.length,interactionFields:interactions[platform]||[],posts};
}
