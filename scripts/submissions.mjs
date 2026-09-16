// Maintainer-only CLI. Uses the existing Wrangler account, never a browser admin key.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { cloudflareEnv } from './cloudflare-env.mjs';
import { normalizeSubmission } from '../worker/submissions.js';
const [command, ...args] = process.argv.slice(2);
const remote = args.includes('--remote'), rest = args.filter(arg=>arg!=='--remote');
const config = remote ? 'wrangler.cloudflare.json' : 'wrangler.json';
const quote = text => "'" + String(text).replaceAll("'", "''") + "'";
async function run(sql) {
  const dir = await mkdtemp(join(tmpdir(),'openaigames-submissions-'));
  try {
    const file = join(dir,'operation.sql'); await writeFile(file,sql);
    const output = execFileSync('npx',['wrangler','d1','execute','DB',remote?'--remote':'--local','--config',config,'--file',file,'--json'],{encoding:'utf8',maxBuffer:4*1024*1024,env:remote?cloudflareEnv():process.env});
    // Remote file imports print upload progress before their JSON result.
    const start = output.search(/^\[\s*(?:\{|\])/m), end = output.lastIndexOf(']');
    if (start < 0 || end < start) throw Error('Wrangler returned no JSON result');
    return JSON.parse(output.slice(start,end+1));
  } finally { await rm(dir,{recursive:true,force:true}); }
}
if (command === 'import' && rest.length === 1) {
  const rows = JSON.parse(await readFile(rest[0],'utf8'));
  if (!Array.isArray(rows) || !rows.length || rows.length>100) throw Error('Expected 1–100 submissions');
  const now = Date.now();
  const sql = rows.map(normalizeSubmission).map(row => `INSERT OR IGNORE INTO game_submissions(request_id,title,url,description,submitter,relation,created_at) VALUES (${[crypto.randomUUID(),row.title,row.url,row.description,row.submitter,row.relation,now].map(quote).join(',')});`).join('\n');
  console.log(JSON.stringify(await run(sql),null,2));
} else if (command === 'export' && rest.length === 1) {
  const result = await run("SELECT id,title,url,description,submitter,relation,status,created_at FROM game_submissions ORDER BY id DESC;");
  await writeFile(rest[0],JSON.stringify(result.flatMap(item=>item.results||[]),null,2)+'\n');
  console.log('Exported submissions to '+rest[0]);
} else {
  console.error('Usage: node scripts/submissions.mjs import input.json | export output.json [--remote]');
  process.exitCode=1;
}
