import {spawnSync} from 'node:child_process';
import {cloudflareEnv} from './cloudflare-env.mjs';
const result=spawnSync('npx',['wrangler',...process.argv.slice(2)],{stdio:'inherit',env:cloudflareEnv()});
if(result.error)throw result.error;
process.exitCode=result.status??1;
