import {empty,freshness,merge,combine,owners,OWNER_KEY,PUBLIC_PROVIDERS,COLLECTED_PROVIDERS,refreshInterval,type Profile} from './model.ts';
import {publicProfile} from './providers.ts';
import {twitchProfile} from './twitch.ts';
import {xPublicProfile} from './x-public.ts';
import {record} from './history.ts';

// Independent source namespaces prevent public refreshes or manual exports from
// overwriting the richer aggregate snapshot owned by the Actions publisher.
export async function creator(env:Env):Promise<Profile[]> {
  const keys=Object.entries(owners).flatMap(([p,u])=>[`export:${p}:${u}`,...(COLLECTED_PROVIDERS.includes(p)?[`lookup:${p}:${u}`]:[])]);
  const [base,sources]=await Promise.all([env.SNAPSHOTS.get<Profile[]>(OWNER_KEY,'json'),env.SNAPSHOTS.get<Profile>(keys,'json')]);
  const imported=base||[];
  const result:Profile[]=[];
  for(const [platform,username] of Object.entries(owners)) {
    let profile=imported.find(p=>p.platform===platform&&p.username===username);
    const exported=sources.get(`export:${platform}:${username}`);
    if(exported)profile=combine(profile,exported);
    if(COLLECTED_PROVIDERS.includes(platform)) {
      const cached=sources.get(`lookup:${platform}:${username}`);
      if(cached)profile=cached.reason==='profile_not_public'?cached:combine(profile,cached);
    }
    if(profile)result.push(freshness(profile));
  }
  return result;
}

export async function saveCreator(env:Env,incoming:Profile[]):Promise<void> {
  const existing=await env.SNAPSHOTS.get<Profile[]>(OWNER_KEY,'json')||[];
  // One non-cancelling Actions concurrency group serializes full publications.
  // KV has eventual visibility; it is not a transaction or multi-writer queue.
  if(existing.length&&Date.parse(existing[0].checkedAt)>Date.parse(incoming[0].checkedAt))throw Error('older_snapshot');
  await record(env,incoming);
  await env.SNAPSHOTS.put(OWNER_KEY,JSON.stringify(incoming.map(next=>merge(existing.find(p=>p.platform===next.platform),next))));
}

export async function saveExport(env:Env,profile:Profile):Promise<void> {
  await record(env,[profile]);
  const key=`export:${profile.platform}:${profile.username}`;
  const old=await env.SNAPSHOTS.get<Profile>(key,'json')||undefined;
  await env.SNAPSHOTS.put(key,JSON.stringify(combine(old,profile)));
}

export async function lookup(env:Env,platform:string,username:string,force=false):Promise<Profile> {
  const key=`lookup:${platform}:${username}`;
  const cached=await env.SNAPSHOTS.get<Profile>(key,'json')||undefined;
  const imported=owners[platform]===username?(await creator(env)).find(p=>p.platform===platform):undefined;
  const saved=cached?combine(imported,cached):imported;
  if(!PUBLIC_PROVIDERS.includes(platform)&&!(platform==='x'&&username===owners.x&&force)) {
    if(cached?.reason==='profile_not_public')return freshness(cached);
    const result=freshness(saved||empty(platform,username));
    if(!saved)result.reason='connection_or_owner_export_required';
    return result;
  }
  if(!force&&cached&&Date.now()-Date.parse(cached.checkedAt)<refreshInterval(platform))return freshness(saved||cached);
  if(!(await env.FETCH_LIMIT.limit({key:'public-provider-budget'})).success) {
    const p=freshness(saved||empty(platform,username));p.reason='refresh_budget_limited';return p;
  }
  let next:Profile;
  try{next=merge(cached,await (platform==='x'?xPublicProfile(username):platform==='twitch'?twitchProfile(username):publicProfile(platform,username)));}
  catch(error) {
    next=structuredClone(cached||empty(platform,username));next.checkedAt=new Date().toISOString();
    for(const m of Object.values(next.metrics))m.current=false;
    const allowed=['profile_not_found','profile_not_public','upstream_limited','identity_mismatch'];const reason=error instanceof Error?error.message:'';
    next.reason=allowed.includes(reason)?reason:'upstream_unavailable';
    if(platform==='x'&&reason==='profile_not_public'){
      next={...empty(platform,username),reason};
      await env.SNAPSHOTS.delete(`content:x:${username}`);
      if(env.HISTORY)await env.HISTORY.prepare('DELETE FROM observations WHERE platform=? AND username=?').bind(platform,username).run();
    }
  }
  next=freshness(next);
  await record(env,[next]);
  await env.SNAPSHOTS.put(key,JSON.stringify(next),{expirationTtl:7*86400});
  return next.reason==='profile_not_public'?next:combine(imported,next);
}
