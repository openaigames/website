import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Miniflare } from 'miniflare';

test('Quick submissions persist, deduplicate, paginate, validate and isolate preview', async () => {
  const dir=await mkdtemp(join(tmpdir(),'oag-submissions-'));
  const options={modules:true,scriptPath:resolve('dist/server/index.js'),compatibilityDate:'2026-05-15',d1Databases:['DB'],d1Persist:dir};
  let mf=new Miniflare(options);
  const payload=(url='https://games.example.org/demo')=>({requestId:crypto.randomUUID(),title:'一个小游戏',url,description:'左右移动，寻找出口。',submitter:'玩家',relation:'recommend',public:true});
  const post=(data,ip='192.0.2.1',headers={})=>mf.dispatchFetch('https://site.example/api/submissions',{method:'POST',headers:{Origin:'https://site.example','Content-Type':'application/json','CF-Connecting-IP':ip,...headers},body:JSON.stringify(data)});
  const get=(query='')=>mf.dispatchFetch('https://site.example/api/submissions'+query);
  try {
    let db=await mf.getD1Database('DB');
    for (const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort()) for (const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint')) if(sql.trim()) await db.prepare(sql).run();
    assert.deepEqual((await (await get()).json()).entries,[]);
    const first=payload(); first.title='<img src=x onerror=alert(1)>';
    let response=await post(first); assert.equal(response.status,201);
    const entry=(await response.json()).entry;
    assert.equal(entry.title,first.title); assert.equal(entry.request_id,undefined); assert.equal(entry.relation,'recommend');
    response=await post(first); assert.equal(response.status,200); assert.equal((await response.json()).entry.id,entry.id);
    assert.equal((await post({...first,title:'changed'})).status,409);
    assert.equal((await post(payload(),'192.0.2.2')).status,409);
    assert.equal((await post(payload('https://games.example.org/two'))).status,429);
    for (const url of ['javascript:alert(1)','http://example.org','https://localhost/x','https://127.0.0.1','https://[::1]','https://user:pass@example.org/','https://example.org:8443/','https://foo.internal/','https://openaigames.lens-frontier.workers.dev/']) assert.equal((await post(payload(url),'192.0.2.3')).status,400,url);
    assert.equal((await post({...payload(),public:false})).status,400);
    assert.equal((await post({...payload(),website:'bot'})).status,400);
    assert.equal((await post({...payload(),description:'  '})).status,400);
    assert.equal((await post({...payload(),relation:'admin'})).status,400);
    assert.equal((await post({...payload(),description:'a'.repeat(501)})).status,400);
    assert.equal((await post({...payload(),title:'a'.repeat(9000)})).status,413);
    assert.equal((await post(payload(),'192.0.2.3',{Origin:'https://other.example'})).status,403);
    assert.equal((await post(payload(),'192.0.2.3',{'Content-Type':'text/plain'})).status,415);
    assert.equal((await get('?before=no')).status,400);
    const raced=await Promise.all([post(payload('https://games.example.org/race1'),'192.0.2.4'),post(payload('https://games.example.org/race2'),'192.0.2.4')]);
    assert.deepEqual(raced.map(r=>r.status).sort(),[201,429]);
    const dupe=await Promise.all([post(payload('https://games.example.org/same'),'192.0.2.5'),post(payload('https://games.example.org/same'),'192.0.2.6')]);
    assert.deepEqual(dupe.map(r=>r.status).sort(),[201,409]);
    for(let i=0;i<20;i++) await db.prepare('INSERT INTO game_submissions(request_id,title,url,description,submitter,relation,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'旅行 '+i,'https://games.example.org/page'+i,'探索','玩家','creator',Date.now()).run();
    const page1=await (await get()).json(),page2=await (await get('?before='+page1.next)).json();
    assert.equal(page1.entries.length,20);assert.equal(page2.entries.length,3);assert.equal(page2.next,null);
    assert.equal(new Set([...page1.entries,...page2.entries].map(e=>e.id)).size,23);
    const filtered=await(await get('?q='+encodeURIComponent('旅行 19'))).json();assert.equal(filtered.entries.length,1);
    await db.prepare("UPDATE game_submissions SET status='archived' WHERE id=?").bind(entry.id).run();
    assert.equal((await(await get('?q='+encodeURIComponent(first.title))).json()).entries.length,0);
    await mf.dispose();mf=new Miniflare(options);assert.deepEqual((await(await get()).json()).entries,page1.entries);
    const preview=new Miniflare({...options,d1Persist:undefined,bindings:{CATALOG_MODE:'preview'}});
    try { assert.equal((await preview.dispatchFetch('https://preview.example/api/submissions')).status,403);assert.equal((await preview.dispatchFetch('https://preview.example/api/submissions',{method:'POST'})).status,403); } finally {await preview.dispose();}
  } finally {await mf.dispose();await rm(dir,{recursive:true,force:true});}
});
