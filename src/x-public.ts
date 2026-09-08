import {boundedText} from './providers.ts';
import {count,empty,object,owners,scope,type Profile} from './model.ts';

// Bounded experiment for the explicitly enrolled creator, not arbitrary X search.
// Uses FxEmbed's documented public API; no cookies, account sessions or paid fallback.
export async function xPublicProfile(username:string,fetcher:typeof fetch=fetch):Promise<Profile>{
 if(username!==owners.x)throw Error('connection_required');
 const url=`https://api.fxtwitter.com/2/profile/${encodeURIComponent(username)}`;
 const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(6000),headers:{Accept:'application/json','User-Agent':'StratusSocial/0.2 (+https://github.com/foulfoxhacks/social-poller)'}});
 if(!response.ok){await response.body?.cancel();throw Error([403,404,410].includes(response.status)?'profile_not_public':response.status===429?'upstream_limited':'upstream_unavailable');}
 if(!response.headers.get('content-type')?.includes('application/json')){await response.body?.cancel();throw Error('upstream_unavailable');}
 const body=object(JSON.parse(await boundedText(response))),user=object(body.user);
 if([403,404,410].includes(Number(body.code)))throw Error('profile_not_public');
 if(body.code!==200)throw Error(body.code===429?'upstream_limited':'upstream_unavailable');
 if(user.protected!==false)throw Error('profile_not_public');
 if(user.screen_name!==username||user.id!=='1818144246383149056')throw Error('identity_mismatch');
 const p=empty('x',username);
 for(const [key,value] of Object.entries({followers:user.followers,following:user.following,posts:user.statuses})){
  if(count(value)!==null&&Number.isSafeInteger(value))p.metrics[key]={value:Number(value),observedAt:p.checkedAt,current:true,precision:'exact',scope:scope(key),source:{kind:'third_party_api',url}};
 }
 return p;
}
