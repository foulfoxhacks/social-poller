import {input,object,profileUrl,fields,owners} from './model.ts';
import {parseCount} from './providers.ts';

// Offline only. Never evaluates scripts, fetches a URL or reads a browser profile.
export const PAGE_LIMIT=8*1024*1024;
export const PAGE_PLATFORMS=['tiktok','youtube','instagram','x','facebook'];
const handle=(v:unknown)=>typeof v==='string'?v.replace(/^@/,'').toLowerCase():'';
const decode=(v:string)=>v.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,(_,code:string)=>{
  const lower=code.toLowerCase();if(lower[0]!=='#')return ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[lower]||'');
  const n=lower[1]==='x'?parseInt(lower.slice(2),16):parseInt(lower.slice(1),10);
  return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'�';
});
function attributes(tag:string):Record<string,string> {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m=>[m[1].toLowerCase(),decode(m[2]??m[3]??m[4])]));
}
function matchesProfile(value:unknown,platform:string,username:string):boolean {
  try {
    const u=new URL(String(value)),expected=new URL(profileUrl(platform,username));
    const host=u.hostname.replace(/^www\./,''),expectedHost=expected.hostname.replace(/^www\./,'');
    return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&
      (host===expectedHost||platform==='x'&&host==='twitter.com')&&decodeURIComponent(u.pathname).replace(/\/$/,'').toLowerCase()===expected.pathname.toLowerCase();
  }catch{return false;}
}
function timestamp(v:string):string {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v))throw Error('explicit_capture_time_required');
  const ms=Date.parse(v);
  if(!Number.isFinite(ms)||ms>Date.now()+60000||new Date(v.slice(0,10)+'T00:00:00Z').toISOString().slice(0,10)!==v.slice(0,10))throw Error('invalid_observation_date');
  return new Date(ms).toISOString();
}
// Balanced JSON object, not eval/Function; strings may contain braces or escapes.
export function initialData(script:string):unknown {
  const match=/(?:\bvar\s+)?\bytInitialData\s*=\s*|window\s*\[\s*["']ytInitialData["']\s*\]\s*=\s*/.exec(script);
  if(!match)return null;
  const start=match.index+match[0].length;if(script[start]!=='{')throw Error('unsupported_saved_page');
  let depth=0,string=false,escaped=false;
  for(let i=start;i<script.length;i++) {
    const c=script[i];if(string){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')string=false;continue;}
    if(c==='"')string=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return JSON.parse(script.slice(start,i+1));
  }
  throw Error('unsupported_saved_page');
}
function text(v:unknown):string {
  if(typeof v==='string')return v;
  const o=object(v);if(typeof o.simpleText==='string')return o.simpleText;if(typeof o.content==='string')return o.content;
  return Array.isArray(o.runs)?o.runs.map(r=>typeof object(r).text==='string'?object(r).text:'').join(''):'';
}

export function parseSavedPage(html:string,platform:string,rawUsername:string,capturedAt:string) {
  if(new TextEncoder().encode(html).byteLength>PAGE_LIMIT)throw Error('payload_too_large');
  const target=input(platform,rawUsername),username=target.username,observedAt=timestamp(capturedAt);
  if(!PAGE_PLATFORMS.includes(platform))throw Error('unsupported_saved_page');
  html=html.replace(/<!--[\s\S]*?-->/g,'');
  const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].map(m=>({attrs:attributes(m[1]),body:m[2]}));
  // Metadata is extracted outside scripts so quoted examples cannot impersonate it.
  const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,'');
  const metas=[...markup.matchAll(/<meta\b[^>]*>/gi)].map(m=>attributes(m[0]));
  const urls=[...metas.filter(m=>m.property==='og:url').map(m=>m.content),...[...markup.matchAll(/<link\b[^>]*>/gi)].map(m=>attributes(m[0])).filter(m=>m.rel?.toLowerCase().split(/\s+/).includes('canonical')).map(m=>m.href)];
  if(urls.some(url=>!matchesProfile(url,platform,username)))throw Error('identity_mismatch');
  const metrics:Record<string,number>={},precision:Record<string,'exact'|'rounded'>={};
  const add=(key:string,value:unknown,rounded=false)=>{
    if(!fields[platform].includes(key)||value===null||value===undefined)return;
    const parsed=parseCount(String(value));if(!parsed||!Number.isSafeInteger(parsed.value))return;
    const quality=rounded?'rounded':parsed.precision;
    if(Object.hasOwn(metrics,key)&&(metrics[key]!==parsed.value||precision[key]!==quality))throw Error('conflicting_counters');
    metrics[key]=parsed.value;precision[key]=quality;
  };
  let verified=false,parser='';
  if(platform==='tiktok') {
    const modern=scripts.filter(s=>s.attrs.id==='__UNIVERSAL_DATA_FOR_REHYDRATION__'),legacy=scripts.filter(s=>s.attrs.id==='SIGI_STATE');
    if(modern.length>1||legacy.length>1)throw Error('conflicting_counters');
    const raw=modern[0]?object(JSON.parse(modern[0].body)):{};
    const detail=object(object(raw.__DEFAULT_SCOPE__)['webapp.user-detail']);
    const info=object(detail.userInfo);let user=object(info.user),stats=object(info.stats);
    const precise=object(info.statsV2);
    if(Object.keys(precise).length)stats={...stats,...precise};
    if(!Object.keys(user).length&&legacy[0]) {
      const module=object(object(JSON.parse(legacy[0].body)).UserModule);
      user=object(object(module.users)[username]);stats=object(object(module.stats)[username]);
    }
    if(handle(user.uniqueId)!==username||!/^\d{1,30}$/.test(String(user.id)))throw Error('identity_mismatch');
    if(user.privateAccount===true||user.secret===true)throw Error('private_profile');
    verified=true;parser='tiktok-profile-json';
    for(const [key,field] of Object.entries({followers:'followerCount',following:'followingCount',posts:'videoCount',likes:'heartCount'}))add(key,stats[field]);
  }else if(platform==='youtube') {
    const data=scripts.map(s=>initialData(s.body)).filter(v=>v!==null);
    if(data.length!==1)throw Error('unsupported_saved_page');
    const root=object(data[0]),metadata=object(object(root.metadata).channelMetadataRenderer);
    if(!matchesProfile(metadata.vanityChannelUrl,platform,username)||!/^UC[\w-]{22}$/.test(String(metadata.externalId))||username===owners.youtube&&metadata.externalId!=='UCug0-yBZw7F7CXfIymeBrYQ')throw Error('identity_mismatch');
    verified=true;parser='youtube-channel-json';
    const header=object(root.header),classic=object(header.c4TabbedHeaderRenderer);
    const strings=[text(classic.subscriberCountText),text(classic.videosCountText)];
    const content=object(object(object(header.pageHeaderRenderer).content).pageHeaderViewModel);
    const rows=object(object(content.metadata).contentMetadataViewModel).metadataRows;
    if(Array.isArray(rows))for(const row of rows){const parts=object(row).metadataParts;if(Array.isArray(parts))for(const part of parts)strings.push(text(object(part).text));}
    for(const s of strings) {
      const m=s.trim().match(/^(\d[\d,.]*[KMB]?)\s+(subscribers?|videos?)$/i);
      if(m)add(/^subscriber/i.test(m[2])?'followers':'posts',m[1],/^subscriber/i.test(m[2]));
    }
  }else if(platform==='instagram') {
    if(!urls.length)throw Error('identity_mismatch');
    verified=true;parser='instagram-profile-metadata';
    for(const m of metas.filter(m=>m.property==='og:description'||m.name==='description')) {
      // Anchored platform metadata only; never numbers found in bios or captions.
      const found=m.content?.match(/^(\d[\d,.]*[KMB]?)\s+Followers,\s*(\d[\d,.]*[KMB]?)\s+Following,\s*(\d[\d,.]*[KMB]?)\s+Posts\s*(?:-|–|—)/i);
      if(found){add('followers',found[1]);add('following',found[2]);add('posts',found[3]);}
    }
  }else if(platform==='x') {
    if(!urls.length)throw Error('identity_mismatch');
    verified=true;parser='x-profile-links';
    for(const m of markup.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
      const attrs=attributes(m[1]);let url:URL;
      try{url=new URL(attrs.href||'/',profileUrl(platform,username));}catch{continue;}
      if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||!['x.com','www.x.com','twitter.com','www.twitter.com'].includes(url.hostname)||url.search||url.hash)continue;
      const route=url.pathname.toLowerCase(),key=route===`/${username}/following`?'following':[`/${username}/followers`,`/${username}/verified_followers`].includes(route)?'followers':null;
      if(!key)continue;
      const label=decode(m[2].replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
      const found=label.match(/^(\d[\d,.]*[KMB]?)\s+(Followers|Following)$/i);
      if(found&&found[2].toLowerCase()===key)add(key,found[1]);
    }
  }else {
    // Only explicit profile-entity JSON-LD statistics, never counts on posts.
    for(const s of scripts.filter(s=>s.attrs.type==='application/ld+json')) {
      const raw:unknown=JSON.parse(s.body),root=object(raw),entities=Array.isArray(raw)?raw:Array.isArray(root['@graph'])?root['@graph']:[root];
      for(const entry of entities) {
        const page=object(entry),entity=page['@type']==='ProfilePage'?object(page.mainEntity):page;
        if(!['Person','Organization'].includes(String(entity['@type']))||!matchesProfile(entity.url,platform,username))continue;
        verified=true;parser='profile-jsonld';
        const values=Array.isArray(entity.interactionStatistic)?entity.interactionStatistic:[entity.interactionStatistic];
        for(const stat of values){const v=object(stat),kind=object(v.interactionType)['@type']??v.interactionType;const action=String(kind).replace(/^https?:\/\/schema.org\//,'');if(action==='FollowAction')add('followers',v.userInteractionCount);if(action==='LikeAction')add('likes',v.userInteractionCount);}
      }
    }
  }
  if(!verified)throw Error('identity_mismatch');
  if(!Object.keys(metrics).length)throw Error('no_recognized_counters');
  return {observation:{...target,observedAt,metrics,precision},parser,sourceKind:'owner_export',sourceUrl:profileUrl(platform,username),missing:fields[platform].filter(k=>!Object.hasOwn(metrics,k)),note:'Owner-supplied saved page; not independently verified or live. Only recognized aggregate counters are included.'};
}
