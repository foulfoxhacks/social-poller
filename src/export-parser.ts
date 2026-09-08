import {object,input,owners,metricKeys,exportedProfile} from './model.ts';
import {parseCount} from './providers.ts';

const LIMIT=262144;
// Parse locally: quoted cells, embedded commas/newlines, BOM and CRLF are supported.
// No formulas are evaluated and no unselected column enters the public result.
export function csvRows(text:string):Record<string,string>[] {
  if(new TextEncoder().encode(text).byteLength>LIMIT)throw Error('payload_too_large');
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false,closed=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
    if(c==='"'){if(cell||closed)throw Error('invalid_csv');quoted=true;continue;}
    if(c===','||c==='\n'||c==='\r') {
      row.push(cell);cell='';closed=false;
      if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v!==''))rows.push(row);row=[];}
      if(rows.length>367||row.length>100)throw Error('too_many_rows');
    }else{if(closed)throw Error('invalid_csv');cell+=c;}
  }
  if(quoted)throw Error('invalid_csv');
  row.push(cell);if(row.some(v=>v!==''))rows.push(row);
  const headings=rows.shift()?.map(h=>h.trim());
  if(!headings?.length||headings.length>100||headings.some(h=>!h)||new Set(headings).size!==headings.length)throw Error('invalid_csv');
  return rows.map(values=>{if(values.length!==headings.length)throw Error('invalid_csv');return Object.fromEntries(headings.map((h,i)=>[h,values[i]]));});
}
function timestamp(value:unknown):string {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value))throw Error('invalid_observation_date');
  const ms=Date.parse(value),day=value.slice(0,10);
  if(!Number.isFinite(ms)||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw Error('invalid_observation_date');
  return new Date(ms).toISOString();
}
export function parseExport(content:string,format:string,mapping:unknown) {
  if(new TextEncoder().encode(content).byteLength>LIMIT)throw Error('payload_too_large');
  const config=object(mapping),target=input(String(config.platform||''),String(config.username||''));
  if(owners[target.platform]!==target.username)throw Error('unapproved_owner');
  const columns=object(config.metrics),keys=Object.keys(columns);
  if(!keys.length||keys.some(k=>!metricKeys(target.platform).includes(k)))throw Error('invalid_mapping');
  for(const column of Object.values(columns))if(typeof column!=='string'||!column)throw Error('invalid_mapping');
  let rows:Record<string,unknown>[];
  if(format==='csv')rows=csvRows(content);
  else if(format==='json'){const data:unknown=JSON.parse(content);if(!Array.isArray(data))throw Error('invalid_export');rows=data.map(object);}
  else throw Error('invalid_export');
  if(!rows.length||rows.length>366)throw Error('too_many_rows');
  return rows.map(row=>{
    const observedAt=timestamp(config.observedAtColumn?row[String(config.observedAtColumn)]:config.observedAt);
    const metrics:Record<string,number>={},precision:Record<string,string>={};
    for(const [key,column] of Object.entries(columns)) {
      if(!Object.hasOwn(row,String(column)))throw Error('missing_column');
      const value=row[String(column)];
      if(value===null||value===undefined||['','—','N/A','null'].includes(String(value).trim()))continue;
      const parsed=parseCount(String(value));if(!parsed)throw Error('invalid_metric');
      const multiplier=object(config.multipliers)[key]??1;
      if(![1,60,3600].includes(Number(multiplier))||(multiplier!==1&&key!=='watchSeconds'))throw Error('invalid_mapping');
      metrics[key]=parsed.value*Number(multiplier);precision[key]=parsed.precision;
    }
    const rawPeriod=object(config.period);
    const period=Object.keys(rawPeriod).length?{
      start:timestamp(rawPeriod.startColumn?row[String(rawPeriod.startColumn)]:rawPeriod.start),
      end:timestamp(rawPeriod.endColumn?row[String(rawPeriod.endColumn)]:rawPeriod.end)
    }:undefined;
    const observation={...target,observedAt,metrics,precision,...(period?{period}:{})};
    exportedProfile(observation); // Same validation as the protected publication route.
    return observation;
  });
}
