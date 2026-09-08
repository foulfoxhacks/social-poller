import {owners,type Profile,type Metric} from './model.ts';

export type Point = {observedAt:string;value:number;precision:Metric['precision'];scope:string;sourceKind:string;sourceUrl:string;sampleSize:number|null};
export type History = {platform:string;username:string;metric:string;days:number;resolution?:'hour'|'day';points:Point[];note:string};
const RETENTION_DAYS=400;

export async function record(env:Env,profiles:Profile[]):Promise<void> {
  if(!env.HISTORY)return; // Local test fixtures / staged binding rollout.
  const cutoff=Date.now()-RETENTION_DAYS*86400000;
  const rows=profiles.filter(p=>owners[p.platform]===p.username).flatMap(p=>Object.entries(p.metrics)
    .filter(([,m])=>m.value!==null&&m.observedAt&&Date.parse(m.observedAt)>=(p.platform==='youtube'?Date.now()-30*86400000:cutoff))
    .map(([key,m])=>env.HISTORY.prepare(`INSERT INTO observations
      (platform,username,metric,observed_at,value,precision,scope,source_kind,source_url,sample_size)
      VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING`).bind(p.platform,p.username,key,m.observedAt,m.value,m.precision,m.scope,m.source.kind,m.source.url,m.sampleSize??null)));
  // Stay below per-request D1 query budgets; a retry is idempotent by primary key.
  for(let i=0;i<rows.length;i+=40)await env.HISTORY.batch(rows.slice(i,i+40));
}

export async function history(env:Env,platform:string,username:string,metric='followers',days=30):Promise<History> {
  const resolution=days===7?'hour':'day';
  const retention=platform==='youtube'?30:RETENTION_DAYS;
  const result:History={platform,username,metric,days,resolution,points:[],note:`${resolution==='hour'?'Hourly':'Daily'} last recorded observation per source, precision, sample size and measurement scope. Missing dates are not estimated. History is retained for ${retention} days.`};
  if(owners[platform]!==username||!env.HISTORY)return result;
  const cutoff=new Date(Date.now()-Math.min(days,retention)*86400000).toISOString();
  const rows=await env.HISTORY.prepare(`SELECT observed_at AS observedAt,value,precision,scope,
    source_kind AS sourceKind,source_url AS sourceUrl,sample_size AS sampleSize FROM (
      SELECT *,ROW_NUMBER() OVER (PARTITION BY substr(observed_at,1,?),scope,source_kind,source_url,precision,sample_size ORDER BY observed_at DESC) AS n
      FROM observations WHERE platform=? AND username=? AND metric=? AND observed_at>=?
    ) WHERE n=1 ORDER BY observed_at DESC LIMIT 1200`).bind(resolution==='hour'?13:10,platform,username,metric,cutoff).all<Point>();
  result.points=rows.results.reverse();
  return result;
}

export async function prune(env:Env):Promise<void> {
  if(env.HISTORY)await env.HISTORY.prepare("DELETE FROM observations WHERE observed_at < ? OR (platform='youtube' AND observed_at < ?)")
    .bind(new Date(Date.now()-RETENTION_DAYS*86400000).toISOString(),new Date(Date.now()-30*86400000).toISOString()).run();
}
