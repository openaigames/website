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
for (const name of ['account.js','account.css','console.js','console.css','site.js','site.css','board.js','board.css','submissions.js','submissions.css','site-polish.css','scene3d.js','scene3d.css','webmcp.js','music.css','mobile-room.css','music','models','console','retro','games','brand','guides','admin']) {
  await cp(resolve(root, 'static', name), resolve(dist, 'client/static', name), { recursive: true });
}
await build({ entryPoints: [resolve(root, 'static/cloud.js')], outfile: resolve(dist, 'client/static/cloud.js'), bundle: true, format: 'iife', platform: 'browser', target: 'es2022' });
await build({ entryPoints: [resolve(root, 'static/console.js')], outfile: resolve(dist, 'client/static/console.js'), bundle: true, format: 'iife', platform: 'browser', target: 'es2022' });
await build({ entryPoints: [resolve(root, 'ui/i18n.mjs')], outfile: resolve(dist, 'client/static/i18n.js'), bundle: true, format: 'iife', platform: 'browser', target: 'es2022' });
await build({ entryPoints: [resolve(root, 'ui/music.mjs')], outfile: resolve(dist, 'client/static/music.js'), bundle: true, format: 'iife', platform: 'browser', target: 'es2022' });
await build({ entryPoints: [resolve(root, 'ui/mobile-room.mjs')], outfile: resolve(dist, 'client/static/mobile-room.js'), bundle: true, format: 'iife', platform: 'browser', target: 'es2022' });
await build({ entryPoints: [resolve(root, 'worker/index.js')], outfile: resolve(dist, 'server/index.js'), bundle: true, format: 'esm', platform: 'browser', target: 'es2022' });
console.log('Built OpenAIGames: community game, 3D console, and persistent player board.');
