import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';
import { normalizeCatalog } from '../lib/catalog.mjs';
import worker from '../worker/index.js';

test('Preview documents retain the PR path when the asset service canonicalizes index.html',async()=>{
  const env={CATALOG_MODE:'preview',ASSETS:{fetch:async(request)=>{
    const path=new URL(request.url).pathname;
    if(path==='/index.html')return Response.redirect('https://preview.example/',307);
    assert.equal(path,'/');
    return new Response('<!doctype html><title>OpenAIGames</title>',{headers:{'Content-Type':'text/html'}});
  }}};
  const response=await worker.fetch(new Request('https://preview.example/community/pr/7?revision='+'a'.repeat(40)),env,{});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('Location'),null);
  assert.equal(response.headers.get('X-Robots-Tag'),'noindex, nofollow');
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.match(await response.text(),/OpenAIGames/);
});

test('Metadata is normalized and unsafe or duplicate game records are rejected',async()=>{
  const seed=JSON.parse(await readFile('content/catalog.json','utf8'));
  const p=seed.projects[0];
  assert.equal(normalizeCatalog(seed).projects[0].id,'dodo');
  assert.equal(normalizeCatalog({projects:[{...p,featured:undefined}]}).projects[0].featured,false);
  assert.throws(()=>normalizeCatalog({projects:[{...p,featured:'yes'}]}));
  for(const preview_url of ['javascript:alert(1)','https://localhost/','https://127.0.0.1/','https://openaigames.lens-frontier.workers.dev/']) assert.throws(()=>normalizeCatalog({projects:[{...p,preview_url}]}));
  assert.throws(()=>normalizeCatalog({projects:[p,p]}));
  assert.throws(()=>normalizeCatalog({projects:[{...p,cover_url:"https://example.com/a');background:red"}]}));
});

test('PR snapshots update, pin revisions, reject stale runs, and publish separately from production',async()=>{
  const common={modules:true,scriptPath:resolve('dist/server/index.js'),compatibilityDate:'2026-05-15',d1Databases:{CATALOG:'shared-catalog-test'}};
  const mf=new Miniflare({workers:[{...common,name:'preview',bindings:{CATALOG_MODE:'preview',CATALOG_PUBLISH_SECRET:'test-only-secret'}},{...common,name:'production',bindings:{CATALOG_MODE:'production'}}]});
  try{
    const db=await mf.getD1Database('CATALOG','preview');
    for(const sql of (await readFile('catalog-migrations/0001_catalog.sql','utf8')).split(';'))if(sql.trim())await db.prepare(sql).run();
    const prod=await mf.getWorker('production');
    const seed=JSON.parse(await readFile('content/catalog.json','utf8'));
    const publish=(data,auth='Bearer test-only-secret')=>mf.dispatchFetch('https://preview.example/internal/catalog',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify(data)});
    const first={channel:'pr-7',revision:'a'.repeat(40),sequence:100,status:'ready',catalog:seed};
    assert.equal((await publish(first,'bad')).status,401);
    assert.equal((await publish({...first,catalog:{projects:[seed.projects[0],seed.projects[0]]}})).status,400);
    assert.equal((await publish(first)).status,200);
    const read=async(path)=>{const response=await mf.dispatchFetch('https://preview.example'+path);return {status:response.status,data:await response.json()};};
    assert.equal((await read('/api/catalog?pr=7')).data.release.revision,first.revision);
    const second={...first,revision:'b'.repeat(40),sequence:200,catalog:{projects:[]}};
    await publish(second); await publish({...first,sequence:150});
    assert.equal((await read('/api/catalog?pr=7')).data.release.revision,second.revision);
    assert.equal((await read('/api/catalog?pr=7&revision='+first.revision)).data.projects.length,seed.projects.length);
    assert.equal((await read('/api/catalog?pr=123')).status,404);
    assert.equal((await read('/api/catalog?pr=../x')).status,400);
    assert.equal((await mf.dispatchFetch('https://preview.example/api/board',{method:'POST'})).status,403);
    assert.equal((await prod.fetch('https://production.example/internal/catalog',{method:'POST'})).status,404);
    assert.equal((await prod.fetch('https://production.example/api/catalog?pr=7')).status,400);
    await publish({...first,channel:'production',sequence:300});
    assert.equal((await (await prod.fetch('https://production.example/api/catalog')).json()).projects.length,seed.projects.length);
    await publish({...second,status:'invalid',sequence:400});
    assert.equal((await read('/api/catalog?pr=7')).status,422);
    assert.equal((await (await prod.fetch('https://production.example/api/catalog')).json()).projects.length,seed.projects.length);
    await publish({...first,status:'closed',sequence:500});
    assert.equal((await read('/api/catalog?pr=7')).data.release.status,'closed');
  }finally{await mf.dispose();}
});
