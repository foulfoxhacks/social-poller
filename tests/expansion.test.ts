import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {csvRows,parseExport} from '../src/export-parser.ts';
import {exportedProfile,empty,owners,combine} from '../src/model.ts';
import {history,record,prune,type History} from '../src/history.ts';
import {graph,motion,motionScript,view} from '../src/views.ts';
import worker from '../src/index.ts';

const at=new Date().toISOString();
const mapping={platform:'youtube',username:owners.youtube,observedAtColumn:'Date',metrics:{followers:'Subscribers'}};
test('CSV parser handles BOM, CRLF, quoted commas, escaped quotes and multiline cells',()=>{
 const rows=csvRows('\uFEFFDate,Subscribers,Private\r\n2026-09-01,"1,234","name, \"\"quoted\"\"\nother"\r\n');
 assert.equal(rows[0].Subscribers,'1,234');assert.equal(rows[0].Private,'name, "quoted"\nother');
});
test('mapped exports preserve zero and rounded counts, without leaking unrelated columns',()=>{
 const result=parseExport('Date,Subscribers,Email\n2026-09-01,0,private@example.test\n2026-09-02,5.5K,private@example.test','csv',mapping);
 assert.equal(result[0].metrics.followers,0);assert.equal(result[1].precision.followers,'rounded');assert.doesNotMatch(JSON.stringify(result),/Email|private/);
 assert.equal(result[0].observedAt,'2026-09-01T00:00:00.000Z');
});
test('export parser rejects ambiguous dates, malformed CSV, formulas, duplicate headers and missing mappings',()=>{
 for(const date of ['09/01/2026','2026-02-30','2100-01-01'])assert.throws(()=>parseExport(`Date,Subscribers\n${date},5`,'csv',mapping));
 for(const text of ['Date,Date\n1,2','Date,Subscribers\n2026-09-01,"5','Date,Subscribers\n2026-09-01,=1+2','Date,Wrong\n2026-09-01,5','Date,Subscribers\n2026-09-01,5,extra'])assert.throws(()=>parseExport(text,'csv',mapping));
 assert.throws(()=>parseExport('x'.repeat(262145),'csv',mapping),/payload/);
 assert.throws(()=>parseExport('[]','json',mapping),/too_many_rows/);
 assert.throws(()=>csvRows(Array.from({length:101},(_,i)=>'Column'+i).join(',')+'\n'),/invalid_csv/);
});
test('report-period metrics require explicit dates and convert hours to seconds only when mapped',()=>{
 const map={...mapping,observedAt:at,observedAtColumn:undefined,metrics:{watchSeconds:'Watch hours'},multipliers:{watchSeconds:3600},period:{start:'2026-09-01',end:'2026-09-02'}};
 const [r]=parseExport('[{"Watch hours":2,"private":"secret"}]','json',map);
 assert.equal(r.metrics.watchSeconds,7200);assert.match(exportedProfile(r).metrics.watchSeconds.scope,/Reporting period/);
 assert.throws(()=>parseExport('[{"Watch hours":2}]','json',{...map,period:{}}),/reporting_period/);
 assert.throws(()=>exportedProfile({...r,period:{start:at,end:'2100-01-01'}}),/reporting_period/);
});
test('independent source refresh does not erase imported reporting-period data',()=>{
 const p=exportedProfile({platform:'youtube',username:owners.youtube,observedAt:at,metrics:{reach:123},period:{start:'2026-09-01',end:'2026-09-02'}});
 assert.equal(combine(p,empty('youtube',owners.youtube)).metrics.reach.value,123);
});
function database(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0001_metric_history.sql',import.meta.url),'utf8'));db.exec(readFileSync(new URL('../migrations/0002_source_aware_observations.sql',import.meta.url),'utf8'));
 const prepare=(sql:string)=>{let values:unknown[]=[];return {bind(...args:unknown[]){values=args;return this;},async run(){db.prepare(sql).run(...values as any[]);return {success:true};},async all(){return {results:db.prepare(sql).all(...values as any[]),success:true};}};};
 const env={HISTORY:{prepare,async batch(statements:{run:()=>Promise<unknown>}[]){db.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}}} as unknown as Env;
 return {env,db};
}
test('seven-day queries retain real hourly readings and distinct sample/source series',async()=>{
 const {env,db}=database();const p=exportedProfile({platform:'tiktok',username:owners.tiktok,observedAt:at,metrics:{followers:10}});
 const before=structuredClone(p);before.metrics.followers.observedAt=new Date(Date.parse(at)-3600000).toISOString();
 const other=structuredClone(p);other.metrics.followers.source.url='https://www.tiktok.com/@akasammythepuppy?source=export';
 const sampled=structuredClone(p);sampled.metrics.followers.sampleSize=12;
 await record(env,[p,before,other,sampled]);
 // Different precision/source/sample identities survive even at the same time.
 sampled.metrics.followers.observedAt=new Date(Date.parse(at)-60000).toISOString();await record(env,[sampled]);
 const hourly=await history(env,'tiktok',owners.tiktok,'followers',7);
 assert.equal(hourly.resolution,'hour');assert.equal(hourly.points.length,4);assert.equal(hourly.points[0].observedAt,before.metrics.followers.observedAt);
 assert.match(hourly.note,/Hourly/);db.close();
});
test('YouTube snapshots older than thirty days cannot be recorded or returned',async()=>{
 const {env,db}=database();const p=empty('youtube',owners.youtube);p.metrics.followers={...p.metrics.followers,value:10,current:true,observedAt:new Date(Date.now()-31*86400000).toISOString()};
 await record(env,[p]);assert.equal((await history(env,'youtube',owners.youtube,'followers',365)).points.length,0);
 assert.match((await history(env,'youtube',owners.youtube)).note,/30 days/);db.close();
});
test('SQL history deduplicates retries, separates sources and scopes, excludes unknown profiles and retains real times',async()=>{
 const {env,db}=database();
 const dailyAt=new Date(Date.now()-86400000);dailyAt.setUTCHours(12,0,0,0);const current=dailyAt.toISOString();
 const p=exportedProfile({platform:'youtube',username:owners.youtube,observedAt:current,metrics:{followers:0}});
 await record(env,[p,p,empty('youtube','unrelated')]);
 let data=await history(env,'youtube',owners.youtube);assert.equal(data.points.length,1);assert.equal(data.points[0].value,0);assert.equal(data.points[0].observedAt,current);
 const older=structuredClone(p);older.metrics.followers.observedAt=new Date(Date.parse(current)-3600000).toISOString();older.metrics.followers.value=5;
 await record(env,[older]);data=await history(env,'youtube',owners.youtube);assert.equal(data.points.length,1);assert.equal(data.points[0].value,0);
 const another=structuredClone(p);another.metrics.followers.source.kind='authorized_api';await record(env,[another]);
 assert.equal((await history(env,'youtube',owners.youtube)).points.length,2);
 assert.equal((await history(env,'youtube','unrelated')).points.length,0);
 db.exec("UPDATE observations SET observed_at='2020'||substr(observed_at,5)");await prune(env);assert.equal((await history(env,'youtube',owners.youtube)).points.length,0);db.close();
});
test('graph never invents an upward trend or connects incompatible sources',()=>{
 const data:History={platform:'youtube',username:owners.youtube,metric:'followers',days:30,points:[],note:'Actual dates only'};
 assert.match(graph(data),/No recorded observations/);assert.doesNotMatch(graph(data),/<polyline/);
 data.points=[{observedAt:at,value:0,precision:'exact',scope:'account',sourceKind:'owner_export',sourceUrl:'https://example.test',sampleSize:null}];
 assert.match(graph(data),/Not enough history/);assert.match(graph(data),/<table/);assert.doesNotMatch(graph(data),/<polyline/);
 data.points.push({...data.points[0],value:8,sourceKind:'authorized_api'});assert.doesNotMatch(graph(data),/<polyline/);
});
test('motion layouts have no forced autoplay, preserve static content and offer explicit controls',()=>{
 const p=empty('github',owners.github);assert.match(motion(p,'carousel'),/Play carousel/);assert.match(motion(p,'ticker'),/data-previous/);
 assert.match(motionScript,/prefers-reduced-motion/);assert.match(motionScript,/visibilitychange/);assert.equal(view('unsafe'),'cards');
});
test('new import is protected, validates entire batch and history queries remain bounded',async()=>{
 const {env,db}=database();const data=new Map<string,string>();Object.assign(env,{IMPORT_TOKEN:'unit-test-secret-over-32-characters',READ_LIMIT:{limit:async()=>({success:true})},SNAPSHOTS:{get:async(k:string)=>data.has(k)?JSON.parse(data.get(k)!):null,put:async(k:string,v:string)=>data.set(k,v)}});
 const request=(path:string,init?:RequestInit)=>new Request('https://test.example'+path,init);
 let r=await worker.fetch(request('/v1/import/export',{method:'POST'}),env,{} as ExecutionContext);assert.equal(r.status,401);
 const headers={'content-type':'application/json',authorization:'Bearer '+env.IMPORT_TOKEN};
 r=await worker.fetch(request('/v1/import/export',{method:'POST',headers,body:JSON.stringify({observations:[{platform:'youtube',username:owners.youtube,observedAt:at,metrics:{followers:9}},{invalid:true}]})}),env,{} as ExecutionContext);assert.equal(r.status,400);assert.equal(data.size,0);
 r=await worker.fetch(request('/v1/history/youtube/'+owners.youtube+'?days=999999'),env,{} as ExecutionContext);assert.equal(r.status,400);
 r=await worker.fetch(request('/v1/history/youtube/'+owners.youtube),env,{} as ExecutionContext);assert.equal(r.status,200);assert.deepEqual((await r.json()).points,[]);db.close();
});
