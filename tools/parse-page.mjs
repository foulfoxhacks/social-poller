import {readFile,stat} from 'node:fs/promises';
import {parseSavedPage,PAGE_LIMIT} from '../src/page-parser.ts';
import {exportedProfile} from '../src/model.ts';

// Usage arguments contain file paths/identity/date, never credentials.
const [file,platform,username,capturedAt,...options]=process.argv.slice(2);
try {
  if(!file||!platform||!username||!capturedAt||options.some(v=>v!=='--publish'))throw Error('usage: npm run parse:page -- saved.html platform username ISO_CAPTURE_TIME [--publish]');
  if(!/\.html?$/i.test(file))throw Error('html_file_required');
  const info=await stat(file);if(!info.isFile()||info.size>PAGE_LIMIT)throw Error('payload_too_large');
  const parsed=parseSavedPage(await readFile(file,'utf8'),platform,username,capturedAt);
  if(!options.includes('--publish'))process.stdout.write(JSON.stringify(parsed,null,2)+'\n');
  else {
    exportedProfile(parsed.observation); // Hosted writes remain registered-owner only.
    const origin=new URL(process.env.SOCIAL_POLLER_URL||'https://social-poller.kc3wca.workers.dev');
    if(origin.origin!=='https://social-poller.kc3wca.workers.dev'||origin.username||origin.password)throw Error('invalid_service_origin');
    const token=process.env.SOCIAL_POLLER_IMPORT_TOKEN;if(!token||token.length<32)throw Error('import_token_required');
    const response=await fetch(new URL('/v1/import/profile',origin),{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json',authorization:`Bearer ${token}`},body:JSON.stringify(parsed.observation)});
    await response.body?.cancel();if(!response.ok)throw Error(`publication_failed_${response.status}`);
    process.stdout.write('Published one owner-supplied aggregate snapshot. No HTML or browser data was uploaded.\n');
  }
}catch(error){
  const message=error instanceof Error?error.message:'';
  process.stderr.write(message.startsWith('usage:')||/^[a-z0-9_]+$/.test(message)?message+'\n':'saved_page_parse_failed\n');process.exitCode=1;
}
