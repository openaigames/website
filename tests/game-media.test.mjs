import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../',import.meta.url);
test('local catalog retains the racing release and all captured game artwork resolves', async () => {
 const catalog=JSON.parse(await readFile(new URL('content/catalog.json',root)));
 const racing=catalog.projects.find(p=>p.id==='nightfury-racing');
 assert.ok(racing?.current_version);assert.equal(racing.creator,'Ziang-Chen');assert.equal(racing.featured,true);
 const media=JSON.parse(await readFile(new URL('content/game-media.json',root)));
 assert.equal(Object.keys(media).length,5);
 for(const [url,item] of Object.entries(media)){
  assert.equal(new URL(url).protocol,'https:');assert.ok(item.development_stage);
  for(const path of new Set([item.cover_url,item.gameplay_url])){
   assert.ok(path.startsWith('/static/games/community/'));
   const buffer=await readFile(new URL(path.slice(1),root));
   assert.ok(buffer.length>1000,`Missing capture: ${path}`);
   assert.equal(buffer.subarray(0,3).toString('hex'),'ffd8ff');
   assert.ok(path.endsWith('.jpg'));
  }
 }
});
