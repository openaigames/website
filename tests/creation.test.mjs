import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
import {normalizeCreation,creationLabel} from '../lib/creation.mjs';
import {normalizeCatalog} from '../lib/catalog.mjs';
import {intakeGame} from '../lib/arcade.mjs';
import {creationBadge,creationDetails} from '../ui/creation.mjs';
import {translate} from '../lib/i18n.mjs';
import {hash,encryptToken} from '../worker/admin-auth.js';

test('Creation declarations default honestly, validate values and survive catalog and intake mapping',async()=>{
  assert.deepEqual(normalizeCreation({}),{creation_method:'undeclared',creation_note:''});
  for(const value of ['human','ai_assisted','ai_generated','undeclared']){
    const data={creation_method:value,creation_note:'  Author explanation  '};
    assert.equal(intakeGame({id:14,...data}).creation_note,'Author explanation');
    const seed=JSON.parse(await readFile('content/catalog.json','utf8'));
    assert.equal(normalizeCatalog({projects:[{...seed.projects[0],...data}]}).projects[0].creation_method,value);
    assert.equal(translate(creationLabel(value),'en'),creationLabel(value,'en'));
  }
  for(const value of [null,0,{},'AI','verified','__proto__','constructor'])assert.throws(()=>normalizeCreation({creation_method:value}));
  for(const value of [null,{},'x'.repeat(501),'a\x00b'])assert.throws(()=>normalizeCreation({creation_note:value}));
  assert.match(creationBadge({featured:true}),/未声明/);
  assert.doesNotMatch(creationDetails({creation_method:'human',creation_note:'<img src=x onerror=alert(1)>'}),/<img/);
});

test('Migration, submission privacy, approval, audited corrections and concurrent edits preserve declarations',async()=>{
  const origin='https://creation.example.org';
  const bindings={GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'test-secret',ADMIN_SESSION_SECRET:'a'.repeat(64),ADMIN_ORIGIN:origin};
  const mf=new Miniflare({modules:true,scriptPath:resolve('dist/server/index.js'),compatibilityDate:'2026-05-15',d1Databases:['DB'],bindings,
    outboundService:async request=>{assert.equal(request.url,'https://api.github.com/user');return Response.json({id:102272920,login:'mattheliu'});}});
  const call=(path,options={})=>mf.dispatchFetch(origin+path,options);
  const post=(path,data,headers={})=>call(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.50',...headers},body:JSON.stringify(data)});
  try{
    const db=await mf.getD1Database('DB');
    const migrations=(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort();
    for(const file of migrations){
      if(file.startsWith('0009'))await db.prepare("INSERT INTO game_submissions(request_id,title,url,description,submitter,relation,status,created_at) VALUES(?,?,?,?,?,?,'approved',1)").bind(crypto.randomUUID(),'Older approved game','https://games.example.org/old','Description','Author','creator').run();
      for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
    }
    const legacy=(await(await call('/api/submissions?id=1')).json()).entry;
    assert.equal(legacy.creation_method,'undeclared');assert.equal(legacy.creation_note,'');
    const data={requestId:crypto.randomUUID(),title:'Declaration test',url:'https://games.example.org/new',description:'Test',submitter:'Author',relation:'creator',public:true,creation_method:'ai_assisted',creation_note:'AI helped with art.'};
    assert.equal((await post('/api/submissions',{...data,creation_method:'verified'})).status,400);
    const submitted=await post('/api/submissions',data);assert.equal(submitted.status,201);const id=(await submitted.json()).entry.id,path='/api/admin/submissions/'+id;
    assert.equal((await call('/api/submissions?id='+id)).status,404);
    assert.equal((await post('/api/submissions',data)).status,200);
    assert.equal((await post('/api/submissions',{...data,creation_method:'human'})).status,409);
    const raw=crypto.randomUUID().replaceAll('-','')+'12345678901',csrf=crypto.randomUUID();
    await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(await hash(raw),102272920,'mattheliu',await encryptToken('admin-token',bindings),csrf,Date.now()+3600000,Date.now()).run();
    const headers={Cookie:'__Host-oag_admin_session='+raw,'X-Admin-CSRF':csrf};
    assert.equal((await post(path,{status:'approved',version:0,note:''},headers)).status,200);
    let entry=(await(await call('/api/submissions?id='+id)).json()).entry;
    assert.equal(entry.creation_method,'ai_assisted');assert.equal(entry.creation_note,data.creation_note);
    const edit={action:'update_creation',status:'approved',version:1,note:'Creator clarified that no generative AI was used.',creation_method:'human',creation_note:'No generative AI; conventional engine only.'};
    assert.equal((await post(path,{...edit,note:''},headers)).status,400);
    assert.equal((await post(path,{...edit,creation_note:null},headers)).status,400);
    assert.equal((await post(path,{...edit,status:'archived'},headers)).status,400);
    assert.equal((await post(path,edit,{...headers,'X-Admin-CSRF':'invalid'})).status,403);
    assert.equal((await post(path,edit)).status,401);
    assert.equal((await post(path,edit,headers)).status,200);
    assert.equal((await post(path,edit,headers)).status,409);
    entry=(await(await call('/api/submissions?id='+id)).json()).entry;
    assert.equal(entry.creation_method,'human');assert.equal(entry.review_note,undefined);
    let audit=await(await call(path,{headers})).json();
    assert.equal(audit.entry.status,'approved');assert.equal(audit.reviews[0].from_status,'approved');
    assert.equal(audit.reviews[0].from_creation_method,'ai_assisted');assert.equal(audit.reviews[0].to_creation_method,'human');
    assert.equal(audit.reviews[0].from_creation_note,data.creation_note);assert.equal(audit.reviews[0].to_creation_note,edit.creation_note);
    assert.equal((await post(path,{...edit,version:2},headers)).status,400);
    const raced=await Promise.all(['undeclared','ai_generated'].map(creation_method=>post(path,{...edit,version:2,creation_method},headers)));
    assert.deepEqual(raced.map(r=>r.status).sort(),[200,409]);
    audit=await(await call(path,{headers})).json();assert.equal(audit.entry.review_version,3);assert.equal(audit.reviews.length,3);
    const final=audit.reviews[0];assert.equal(audit.entry.creation_method,final.to_creation_method);
    assert.equal((await post(path,{status:'archived',version:3,note:'Archive test'},headers)).status,200);
    assert.equal((await call('/api/submissions?id='+id)).status,404);
  }finally{await mf.dispose();}
});
