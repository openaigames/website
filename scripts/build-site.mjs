import { cp, mkdir, readFile, rm, copyFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { normalizeCatalog } from '../lib/catalog.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const catalog = JSON.parse(await readFile(resolve(root, 'content/catalog.json'), 'utf8'));
normalizeCatalog(catalog);
await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, 'client/static'), { recursive: true });
await copyFile(resolve(root, 'content/catalog.json'), resolve(dist, 'client/catalog.json'));
await copyFile(resolve(root, 'static/index.html'), resolve(dist, 'client/index.html'));
for (const name of ['console.js','console.css','site.js','site.css','board.js','board.css','submissions.js','submissions.css','scene3d.js','scene3d.css','cloud.js','webmcp.js','models','console','retro','games']) {
  await cp(resolve(root, 'static', name), resolve(dist, 'client/static', name), { recursive: true });
}
await build({ entryPoints: [resolve(root, 'worker/index.js')], outfile: resolve(dist, 'server/index.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
console.log('Built OpenAIGames: community game, 3D console, and persistent player board.');
