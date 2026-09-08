export type SourceKind = 'public_api' | 'authorized_api' | 'owner_export' | 'third_party_api';
export type Metric = {value:number|null; observedAt:string|null; current:boolean; precision:'exact'|'rounded'|'sample'; scope:string; source:{kind:SourceKind;url:string}; sampleSize?:number|null};
export type Breakdown = {rows:{key:string;label:string;percent:number}[]; sampledAt:string|null;current:boolean;window:string};
export type Profile = {schemaVersion:1;platform:string;username:string;profileUrl:string;checkedAt:string;status:string;metrics:Record<string,Metric>;demographics?:Record<string,Breakdown>;reason?:string};
export const SIX_HOURS=6*60*60*1000;
export const TEN_MINUTES=10*60*1000;
export const PUBLIC_PROVIDERS=['github','bluesky','twitch'];
export const COLLECTED_PROVIDERS=[...PUBLIC_PROVIDERS,'x'];
export const scheduledPlatforms=(cron:string)=>cron==='*/5 * * * *'?['twitch','x']:['github','bluesky','x'];
export const refreshInterval=(platform:string)=>platform==='twitch'?5*60*1000:TEN_MINUTES;
export const OWNER='akasammythepuppy';
export const OWNER_KEY='creator:'+OWNER;
export const fields:Record<string,string[]>={
  instagram:['followers','following','posts','sampleLikes','averageLikes','averageComments'],
  tiktok:['followers','following','posts','likes','averageViews','averageLikes','averageComments'],
  youtube:['followers','posts','views'],twitch:['followers','viewers'],bluesky:['followers','following','posts'],
  x:['followers','following','posts'],github:['followers','following','repositories','stars'],
  facebook:['followers'],kick:['followers','viewers'],reddit:['karma'],
  vrchat:[],steam:[],playstation:[],spotify:[]
};
export const owners:Record<string,string>={instagram:OWNER,tiktok:OWNER,youtube:OWNER,twitch:OWNER,bluesky:'akasammythepuppy.me',x:'akasammythepup',github:'foulfoxhacks',facebook:OWNER,kick:OWNER,reddit:'luvzfurrz01998',vrchat:'usr_bd9e07ff-9706-42ca-9715-1cb5a76e3c72',steam:OWNER,playstation:'itscutiesammyowo',spotify:'2z4kruowiuhpf3w0vvhmhdpoz'};
export const names:Record<string,string>={instagram:'Instagram',tiktok:'TikTok',youtube:'YouTube',twitch:'Twitch',bluesky:'Bluesky',x:'X',github:'GitHub',facebook:'Facebook',kick:'Kick',reddit:'Reddit',vrchat:'VRChat',steam:'Steam',playstation:'PlayStation',spotify:'Spotify'};
export const labels:Record<string,string>={followers:'Followers / subscribers',following:'Following',posts:'Posts / public videos',likes:'Account likes',sampleLikes:'Likes on sampled posts',averageLikes:'Average likes',averageComments:'Average comments',averageViews:'Average views',views:'Lifetime views',viewers:'Live viewers',repositories:'Public repositories',stars:'Public repository stars',karma:'Karma'};
export const reportLabels:Record<string,string>={periodViews:'Views in reporting period',reach:'Accounts reached in reporting period',impressions:'Impressions in reporting period',engagements:'Interactions in reporting period',watchSeconds:'Watch time (seconds) in reporting period',linkClicks:'Link clicks in reporting period',shares:'Shares in reporting period',saves:'Saves in reporting period'};
export const metricKeys=(platform:string)=>[...(fields[platform]||[]),...(fields[platform]?.length?Object.keys(reportLabels):[])];
export function object(value:unknown):Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}
export function count(value:unknown):number|null {return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER?value:null;}
export function date(value:unknown):string|null {return typeof value==='string'&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.now()+60000?new Date(value).toISOString():null;}
export function input(platform:string,raw:string):{platform:string;username:string}{
  const username=raw.replace(/^@/,'').toLowerCase();
  if(!Object.hasOwn(fields,platform)||username.length>253)throw Error('invalid_profile');
  const valid=platform==='bluesky'?/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(username):/^[a-z0-9][a-z0-9_.-]{0,79}$/.test(username);
  if(!valid)throw Error('invalid_profile');
  return {platform,username};
}
export function profileUrl(platform:string,username:string):string {
  const prefixes:Record<string,string>={instagram:'https://www.instagram.com/',tiktok:'https://www.tiktok.com/@',youtube:'https://www.youtube.com/@',twitch:'https://www.twitch.tv/',bluesky:'https://bsky.app/profile/',x:'https://x.com/',github:'https://github.com/',facebook:'https://www.facebook.com/',kick:'https://kick.com/',reddit:'https://www.reddit.com/user/',vrchat:'https://vrchat.com/home/user/',steam:'https://steamcommunity.com/id/',playstation:'https://profile.playstation.com/',spotify:'https://open.spotify.com/user/'};
  return prefixes[platform]+encodeURIComponent(username);
}
export function scope(key:string):string {return key.startsWith('average')||key==='sampleLikes'?'lifetime counters on a recent-post sample':key==='viewers'?'concurrent at observation':key==='stars'?'sum on owned public repositories':'account total at observation';}
export function empty(platform:string,username:string,now=new Date().toISOString()):Profile {
  return {schemaVersion:1,platform,username,profileUrl:profileUrl(platform,username),checkedAt:now,status:'unavailable',metrics:Object.fromEntries(fields[platform].map(k=>[k,{value:null,observedAt:null,current:false,precision:k.startsWith('average')||k==='sampleLikes'?'sample':'exact',scope:scope(k),source:{kind:'public_api',url:profileUrl(platform,username)}}]))};
}
export function freshness(profile:Profile,now=Date.now()):Profile {
  const copy=structuredClone(profile);
  // Older KV snapshots may predate newly supported fields. Add unknown defaults
  // without rewriting saved observations, their provenance or reporting fields.
  copy.metrics={...empty(profile.platform,profile.username,profile.checkedAt).metrics,...copy.metrics};
  if(profile.platform==='facebook')delete copy.metrics.likes; // Confirmed personal profile, not a Page.
  if(profile.platform==='youtube')for(const [key,m] of Object.entries(copy.metrics)){
    if(m.observedAt&&now-Date.parse(m.observedAt)>30*86400000)copy.metrics[key]={...m,value:null,observedAt:null,current:false};
  }
  for(const m of Object.values(copy.metrics))m.current=m.current&&m.value!==null&&m.observedAt!==null&&now-Date.parse(m.observedAt)>=0&&now-Date.parse(m.observedAt)<=(m.source.kind==='third_party_api'?TEN_MINUTES:SIX_HOURS);
  for(const b of Object.values(copy.demographics||{}))b.current=b.current&&!!b.sampledAt&&now-Date.parse(b.sampledAt)>=0&&now-Date.parse(b.sampledAt)<=SIX_HOURS;
  const values=Object.values(copy.metrics);const available=values.filter(m=>m.current).length;
  copy.status=available?(available===values.length?'current':'partial'):values.some(m=>m.value!==null)?'stale':'unavailable';
  return copy;
}
export function merge(old:Profile|undefined,next:Profile):Profile {
  if(!old)return next;
  if(old.platform!==next.platform||old.username!==next.username)throw Error('identity_mismatch');
  const copy=structuredClone(next);
  copy.checkedAt=Date.parse(old.checkedAt)>Date.parse(next.checkedAt)?old.checkedAt:next.checkedAt;
  for(const [key,m] of Object.entries(copy.metrics)){
    const before=old.metrics[key];
    if(before?.observedAt&&(!m.observedAt||Date.parse(before.observedAt)>Date.parse(m.observedAt)))copy.metrics[key]={...before,current:m.observedAt?before.current:false};
  }
  return freshness(copy);
}
// Independent sources do not treat an absent field as a failed refresh.
export function combine(old:Profile|undefined,next:Profile):Profile {
  if(!old)return freshness(next);
  const copy=merge(old,next);
  if(next.reason==='profile_not_public')return freshness(next);
  const previous=freshness(old);
  for(const [key,before] of Object.entries(old.metrics)){
    const after=next.metrics[key];
    const independentFailure=previous.metrics[key]?.current&&after?.current===false&&(before.source.kind!==after.source.kind||before.source.url!==after.source.url);
    if(before.observedAt&&(!after?.observedAt||Date.parse(before.observedAt)>Date.parse(after.observedAt)||independentFailure))copy.metrics[key]=structuredClone(before);
  }
  copy.demographics={...old.demographics,...next.demographics};
  return freshness(copy);
}
export function fromLegacy(data:unknown,kind:SourceKind='authorized_api',url='https://akasammythepuppy.me/assets/data/media-kit.json'):Profile[]{
  const root=object(data),platforms=object(root.platforms),generatedAt=date(root.generatedAt);
  if(root.version!==1||!generatedAt||Object.keys(platforms).length>20||!['instagram','tiktok','youtube','twitch','bluesky','x','github'].every(id=>Object.hasOwn(platforms,id)))throw Error('invalid_snapshot');
  const result:Profile[]=[];
  for(const platform of ['instagram','tiktok','youtube','twitch','bluesky','x','github',...(Object.hasOwn(platforms,'kick')?['kick']:[])]){
    const p=empty(platform,owners[platform],generatedAt),source=object(platforms[platform]),metrics=object(source.metrics);
    for(const key of fields[platform]){
      const m=object(metrics[key]),value=count(m.value),observedAt=date(m.sampledAt);
      if(value===null||!observedAt)continue;
      p.metrics[key]={value,observedAt,current:m.current===true,precision:key.startsWith('average')||key==='sampleLikes'?'sample':platform==='youtube'&&key==='followers'?'rounded':'exact',scope:scope(key),source:{kind:['github','bluesky','youtube'].includes(platform)?'public_api':kind,url:platform==='youtube'?profileUrl(platform,owners[platform]):url},...(key.startsWith('average')||key==='sampleLikes'?{sampleSize:count(m.sampleSize)}:{})};
    }
    if(platform==='instagram'){
      p.demographics={};
      for(const dimension of ['age','gender','country']){
        const d=object(object(source.demographics)[dimension]),observed=date(d.sampledAt);
        const rows=Array.isArray(d.rows)&&d.rows.length<=10?d.rows.map(object):[];
        const permitted=(r:Record<string,unknown>)=>dimension==='age'?['13-17','18-24','25-34','35-44','45-54','55-64','65+'].includes(String(r.key)):dimension==='gender'?['M','F','U'].includes(String(r.key)):/^[A-Z]{2}$/.test(String(r.key));
        const safe=rows.filter(r=>permitted(r)&&count(r.percent)!==null&&Number(r.percent)<=100).map(r=>({key:String(r.key),label:dimension==='gender'?({M:'Male',F:'Female',U:'Unspecified'}[String(r.key)]||'Unspecified'):String(r.key),percent:Number(r.percent)}));
        const valid=!!observed&&d.window==='last_30_days'&&new Set(safe.map(r=>r.key)).size===safe.length&&safe.reduce((sum,r)=>sum+r.percent,0)<=101;
        p.demographics[dimension]={rows:valid?safe:[],sampledAt:valid?observed:null,current:valid&&d.current===true,window:'last_30_days'};
      }
    }
    result.push(freshness(p));
  }
  return result;
}
export function toLegacy(profiles:Profile[]){
  return {version:1,generatedAt:new Date(Math.max(0,...profiles.map(p=>Date.parse(p.checkedAt)))).toISOString(),platforms:Object.fromEntries(Object.keys(owners).map(id=>{
    const p=freshness(profiles.find(p=>p.platform===id&&p.username===owners[id])||empty(id,owners[id]));
    return [id,{checkedAt:p.checkedAt,...(p.reason==='profile_not_public'?{withheld:true}:{}),metrics:Object.fromEntries(Object.entries(p.metrics).map(([key,m])=>[key,{value:m.value,sampledAt:m.observedAt,current:m.current,...(m.sampleSize!==undefined?{sampleSize:m.sampleSize}:{}),precision:m.precision,scope:m.scope,source:m.source}])),...(p.demographics?{demographics:p.demographics}:{})}];
  }))};
}
export function exportedProfile(data:unknown):Profile{
  const r=object(data),{platform,username}=input(String(r.platform||''),String(r.username||''));
  if(owners[platform]!==username)throw Error('unapproved_owner');
  const observedAt=date(r.observedAt);if(!observedAt)throw Error('invalid_observation_date');
  const profile=empty(platform,username),metrics=object(r.metrics);
  for(const [key,value] of Object.entries(metrics)){
    if(!metricKeys(platform).includes(key)||count(value)===null)throw Error('invalid_metric');
    const precision=object(r.precision)[key];
    if(precision!==undefined&&!['exact','rounded','sample'].includes(String(precision)))throw Error('invalid_metric');
    let measurementScope=scope(key);
    if(Object.hasOwn(reportLabels,key)) {
      const period=object(r.period),start=date(period.start),end=date(period.end);
      if(!start||!end||Date.parse(start)>Date.parse(end)||Date.parse(end)>Date.parse(observedAt))throw Error('invalid_reporting_period');
      measurementScope=`Reporting period: ${start} to ${end}`;
    }
    profile.metrics[key]={value:Number(value),observedAt,current:true,precision:key.startsWith('average')||key==='sampleLikes'?'sample':precision==='rounded'?'rounded':'exact',scope:measurementScope,source:{kind:'owner_export',url:profile.profileUrl},...(key.startsWith('average')||key==='sampleLikes'?{sampleSize:count(object(r.sampleSize)[key])}:{})};
  }
  if(!Object.keys(metrics).length)throw Error('empty_export');
  return freshness(profile);
}
