import {count,empty,object,scope,type Profile} from './model.ts';
const USER_AGENT='SocialPoller/0.1 (+https://github.com/foulfoxhacks/social-poller)';
export async function boundedText(response:Response,limit=262144):Promise<string>{
  if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw Error('payload_too_large');}
  if(!response.body)return '';
  const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,text='';
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit)throw Error('payload_too_large');text+=decoder.decode(part.value,{stream:true});}return text+decoder.decode();}
  finally{await reader.cancel().catch(()=>{});}
}
export async function publicProfile(platform:string,username:string,fetcher:typeof fetch=fetch):Promise<Profile>{
  if(!['github','bluesky'].includes(platform))throw Error('connection_required');
  const url=platform==='github'?`https://api.github.com/users/${encodeURIComponent(username)}`:`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(username)}`;
  const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(6000),headers:{'User-Agent':USER_AGENT,'Accept':'application/json',...(platform==='github'?{'X-GitHub-Api-Version':'2026-03-10'}:{})}});
  if(response.status===404){await response.body?.cancel();throw Error('profile_not_found');}
  if(!response.ok){await response.body?.cancel();throw Error(response.status===429||response.status===403?'upstream_limited':'upstream_unavailable');}
  const p=object(JSON.parse(await boundedText(response)));
  if(String(platform==='github'?p.login:p.handle).toLowerCase()!==username)throw Error('identity_mismatch');
  const result=empty(platform,username);
  const values:Record<string,unknown>=platform==='github'?{followers:p.followers,following:p.following,repositories:p.public_repos}:{followers:p.followersCount,following:p.followsCount,posts:p.postsCount};
  for(const [key,value] of Object.entries(values))if(count(value)!==null)result.metrics[key]={value:Number(value),observedAt:result.checkedAt,current:true,precision:'exact',scope:scope(key),source:{kind:'public_api',url}};
  if(platform==='github'&&count(p.public_repos)!==null&&Number(p.public_repos)<=100){
    const reposUrl=`https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&per_page=100`;
    try{
      const response=await fetcher(reposUrl,{redirect:'manual',signal:AbortSignal.timeout(6000),headers:{'User-Agent':USER_AGENT,'Accept':'application/json','X-GitHub-Api-Version':'2026-03-10'}});
      if(!response.ok){await response.body?.cancel();throw Error('stars_unavailable');}
      const repos:unknown=JSON.parse(await boundedText(response,1048576));
      if(!Array.isArray(repos)||repos.length!==p.public_repos)throw Error('stars_incomplete');
      let total=0;
      for(const entry of repos){const repo=object(entry);if(String(object(repo.owner).login).toLowerCase()!==username||count(repo.stargazers_count)===null)throw Error('stars_incomplete');total+=Number(repo.stargazers_count);}
      result.metrics.stars={value:total,observedAt:result.checkedAt,current:true,precision:'exact',scope:scope('stars'),source:{kind:'public_api',url:reposUrl}};
    }catch{result.reason='repository_star_total_unavailable';}
  }else if(platform==='github')result.reason='repository_star_total_outside_lookup_limit';
  return result;
}

// Strict parsing utility for owner-supplied export fields, not a page scraper.
export function parseCount(text:string):{value:number;precision:'exact'|'rounded'}|null{
  const match=text.trim().match(/^(\d+(?:,\d{3})*(?:\.\d+)?)([KMB])?$/i);if(!match)return null;
  const value=Number(match[1].replaceAll(',',''))*({K:1000,M:1e6,B:1e9}[match[2]?.toUpperCase()]||1);
  return count(value)===null?null:{value,precision:match[2]?'rounded':'exact'};
}
