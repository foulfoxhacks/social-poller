import {readFile,stat} from 'node:fs/promises';
import {parseExport} from '../src/export-parser.ts';

// Explicit local paths only; never fetches platform pages or reads browser cookies.
const [file,mappingFile,...options]=process.argv.slice(2);
try {
  if(!file||!mappingFile||options.some(v=>v!=='--publish'))throw Error('usage: npm run import:export -- data.csv mapping.json [--publish]');
  if((await stat(file)).size>262144||(await stat(mappingFile)).size>16384)throw Error('payload_too_large');
  const observations=parseExport(await readFile(file,'utf8'),file.toLowerCase().endsWith('.csv')?'csv':'json',JSON.parse(await readFile(mappingFile,'utf8')));
  if(!options.includes('--publish')){
    // Preview only the allowlisted, public aggregates; unselected export columns stay local.
    process.stdout.write(JSON.stringify({observations},null,2)+'\n');
  }else{
    const origin=new URL(process.env.SOCIAL_POLLER_URL||'https://social-poller.kc3wca.workers.dev');
    if(origin.protocol!=='https:'||origin.hostname!=='social-poller.kc3wca.workers.dev'||origin.username||origin.password)throw Error('invalid_service_origin');
    const token=process.env.SOCIAL_POLLER_IMPORT_TOKEN;if(!token||token.length<32)throw Error('import_token_required');
    for(let i=0;i<observations.length;i+=10){
      const response=await fetch(new URL('/v1/import/export',origin),{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify({observations:observations.slice(i,i+10)})});
      if(!response.ok)throw Error(`publication_failed_${response.status}`);
    }
    process.stdout.write(`Published ${observations.length} aggregate observations. No raw export was uploaded.\n`);
  }
}catch(error){
  // Parser errors are fixed strings. Never print input rows, response bodies or credentials.
  const message=error instanceof Error?error.message:'import_failed';
  process.stderr.write(message.startsWith('usage:')||/^[a-z0-9_]+$/.test(message)?message+'\n':'import_failed\n');process.exitCode=1;
}
