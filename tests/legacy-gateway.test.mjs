import test from 'node:test';import assert from 'node:assert/strict';import proxy from '../worker/legacy-gateway.js';
const env={UPSTREAM:'https://openaigames.org',UPSTREAM_RELAY_SECRET:'new',BOARD_RELAY_SECRET:'old',GATEWAY_MODE:'production'};
const make=(path='/api/board',options={})=>new Request('https://openaigames.lens-frontier.workers.dev'+path,options);
test('proxy uses only upstream, preserves URLs, signs visitors, rejects cross-origin and invalid legacy signatures',async()=>{
 const original=globalThis.fetch;const seen=[];globalThis.fetch=async(url,options)=>{seen.push({url:String(url),...options});return Response.json({ok:true});};
 try{
  assert.equal((await proxy.fetch(make('/api/submissions?q=hi'),env)).status,200);assert.equal(seen[0].url,'https://openaigames.org/api/submissions?q=hi');
  const post=(extra={})=>make('/api/board',{method:'POST',headers:{Origin:'https://openaigames.lens-frontier.workers.dev','Content-Type':'application/json','CF-Connecting-IP':'1.1.1.1',...extra},body:'{}'});
  assert.equal((await proxy.fetch(post(),env)).status,200);assert.equal(seen.at(-1).headers.get('Origin'),env.UPSTREAM);
  const h=seen.at(-1).headers,enc=new TextEncoder(),k=await crypto.subtle.importKey('raw',enc.encode('new'),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  assert.ok(await crypto.subtle.verify('HMAC',k,Uint8Array.from(h.get('X-Board-Signature').match(/../g),v=>parseInt(v,16)),enc.encode(`POST\n/api/board\n${h.get('X-Board-Time')}\n${h.get('X-Board-Client')}`)));
  const first=h.get('X-Board-Client');await proxy.fetch(post({'CF-Connecting-IP':'2.2.2.2'}),env);assert.notEqual(first,seen.at(-1).headers.get('X-Board-Client'));
  assert.equal((await proxy.fetch(post({Origin:'https://attacker.invalid'}),env)).status,403);
  assert.equal((await proxy.fetch(post({'X-Board-Client':'a'.repeat(64)}),env)).status,403);
  assert.equal((await proxy.fetch(post(),{...env,MIGRATION_READ_ONLY:'1'})).status,503);
  assert.equal((await proxy.fetch(make('/internal/catalog',{method:'POST',body:'{}'}),env)).status,403);
  const preview={...env,GATEWAY_MODE:'preview',CATALOG_PUBLISH_SECRET:'before',UPSTREAM_PUBLISH_SECRET:'after'};
  assert.equal((await proxy.fetch(make('/internal/catalog',{method:'POST',headers:{Authorization:'Bearer before'},body:'{}'}),preview)).status,200);assert.equal(seen.at(-1).headers.get('Authorization'),'Bearer after');
  globalThis.fetch=async()=>{throw Error('unreachable');};assert.equal((await proxy.fetch(make(),env)).status,503);
 }finally{globalThis.fetch=original;}
});

test('legacy login redirects to the canonical site and never forwards session cookies',async()=>{
 const original=globalThis.fetch;let forwarded=false;globalThis.fetch=async()=>{forwarded=true;throw Error('must not forward');};
 try{for(const path of ['/admin','/api/auth/github/login?return=room']){const r=await proxy.fetch(make(path,{headers:{Cookie:'secret'}}),env);assert.equal(r.status,303);assert.equal(r.headers.get('Location'),'https://openaigames.org'+path);}
 for(const path of ['/api/auth/session','/api/admin/submissions'])assert.equal((await proxy.fetch(make(path),env)).status,401);assert.equal(forwarded,false);
 }finally{globalThis.fetch=original;}
});
