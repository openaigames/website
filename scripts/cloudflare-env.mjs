import {existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
// Keep the domain account isolated from credentials used by unrelated projects.
export function cloudflareEnv(){
 const isolated=process.env.OPENAIGAMES_CLOUDFLARE_CONFIG_HOME||join(homedir(),'.config','openaigames-cloudflare-qq');
 if(process.env.CLOUDFLARE_API_TOKEN||process.env.CLOUDFLARE_API_KEY||process.env.XDG_CONFIG_HOME)return {...process.env};
 return existsSync(join(isolated,'.wrangler','config','default.toml'))?{...process.env,XDG_CONFIG_HOME:isolated}:{...process.env};
}
