import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
import {hash,encryptToken} from '../worker/admin-auth.js';
import {flowReport,recordOutcome} from '../worker/analytics-flows.js';
const origin='https://openaigames.org',DAY=86400000;
const env={ANALYTICS_ENABLED:'1',GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'test-secret',ADMIN_SESSION_SECRET:'a'.repeat(64),ADMIN_ORIGIN:origin};
async function fixture(){
 const mf=new Miniflare({modules:true,scriptPath:resolve('dist/server/index.js'),compatibilityDate:'2026-05-15',d1Databases:['DB'],bindings:env,serviceBindings:{ASSETS:()=>Response.json({projects:[{id:'dodo',title:'Dodo',preview_url:'https://games.example.org/dodo'}]})},outboundService:request=>Response.json(request.url.includes('access_token')?{access_token:'test-token'}:{id:102272920,login:'local-test'})});
 const db=await mf.getD1Database('DB');for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 const visitor=crypto.randomUUID(),visit=crypto.randomUUID(),flow=crypto.randomUUID();
 const call=(path,options={})=>mf.dispatchFetch(origin+path,{redirect:'manual',...options});
 const collect=(input,headers={})=>call('/api/analytics/event',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify({id:crypto.randomUUID(),visitor,source:'direct',device:'desktop',...input})});
 assert.equal((await collect({id:visit,kind:'pageview',version:2})).status,204);
 const step=(family,name,more={})=>collect({kind:'step',visit,flow,attempt:flow,family,step:name,...more});
 const report=()=>flowReport(db,Date.now()-DAY,Date.now()+10000);
 const attempt=async(family,game,code='')=>{const id=crypto.randomUUID();assert.equal((await step(family,'attempt',{attempt:id,...(game?{game}:{}),code})).status,204);return id;};
 const post=(path,body,attempt,headers={})=>call(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-OAG-Telemetry':JSON.stringify({visitor,visit,flow,attempt}),...headers},body:JSON.stringify(body)});
 const session=async()=>{const raw=crypto.randomUUID().replaceAll('-','')+'12345678901';await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(await hash(raw),102272920,'local-test',await encryptToken('test-token',env),'csrf',Date.now()+3600000,Date.now()).run();return {Cookie:'__Host-oag_admin_session='+raw,'X-Admin-CSRF':'csrf'};};
 return {mf,db,visitor,visit,flow,call,collect,step,attempt,post,session,report};
}
test('Journey validation owns visits, deduplicates stages and rejects fabricated saved outcomes or private text',async()=>{
 const f=await fixture();try{
  assert.equal((await f.step('submission','open')).status,204);
  for(let i=0;i<3;i++)assert.equal((await f.step('submission','input')).status,204);
  assert.equal((await f.step('submission','success')).status,400);
  assert.equal((await f.step('search','results',{search:'private query'})).status,400);
  assert.equal((await f.step('submission','input',{visitor:crypto.randomUUID()})).status,404);
  assert.equal((await f.step('room','ready')).status,409);
  assert.equal((await f.step('game','open',{flow:crypto.randomUUID()})).status,400);
  assert.equal((await f.step('submission','error',{code:'private stack'})).status,400);
  const rows=(await f.db.prepare('SELECT * FROM analytics_steps').all()).results;assert.equal(rows.length,2);assert.notEqual(rows[0].visitor,f.visitor);
  assert.equal((await f.call('/api/admin/analytics')).status,401);
 }finally{await f.mf.dispose();}
});
test('Submission funnel records actual saved writes, retries and failures without storing form fields',async()=>{
 const f=await fixture();try{
  await f.step('submission','open');await f.step('submission','input');
  const body={requestId:crypto.randomUUID(),title:'Private draft title',url:'https://games.example.org/new-game',description:'Never copy this into analytics',submitter:'Private nickname',relation:'creator',public:true};
  const a=await f.attempt('submission');assert.equal((await f.post('/api/submissions',body,a)).status,201);assert.equal((await f.post('/api/submissions',body,a)).status,200);
  const bad=await f.attempt('submission');assert.equal((await f.post('/api/submissions',{...body,title:''},bad)).status,400);
  const report=await f.report(),s=report.families.find(r=>r.family==='submission');assert.equal(s.opened,1);assert.equal(s.input,1);assert.equal(s.success,1);assert.equal(s.failed,0);
  const rows=(await f.db.prepare('SELECT * FROM analytics_steps').all()).results;assert.equal(rows.filter(r=>r.step==='success').length,1);assert.ok(!JSON.stringify(rows).includes('Private'));assert.ok(!JSON.stringify(rows).includes('Never copy'));
 }finally{await f.mf.dispose();}
});
test('Feedback attempts need authentication and CSRF, and only saved ratings/likes/comments count',async()=>{
 const f=await fixture();try{
  await f.step('feedback','open',{game:'dodo'});const headers=await f.session();
  const a=await f.attempt('feedback','dodo','rate');assert.equal((await f.post('/api/comments?game=dodo',{action:'rate',rating:5},a)).status,401);
  const b=await f.attempt('feedback','dodo','rate');assert.equal((await f.post('/api/comments?game=dodo',{action:'rate',rating:5},b,headers)).status,200);
  const c=await f.attempt('feedback','dodo','like');assert.equal((await f.post('/api/comments?game=dodo',{action:'like',liked:true},c,headers)).status,200);
  const d=await f.attempt('feedback','dodo','comment');assert.equal((await f.post('/api/comments?game=dodo',{body:'Secret review text',requestId:crypto.randomUUID()},d,headers)).status,201);
  const report=await f.report();assert.deepEqual(report.actions.find(r=>r.code==='rate'),{code:'rate',attempted:2,saved:1});assert.equal(report.actions.find(r=>r.code==='like').saved,1);assert.equal(report.actions.find(r=>r.code==='comment').saved,1);
  const rows=(await f.db.prepare('SELECT * FROM analytics_steps').all()).results;assert.ok(!JSON.stringify(rows).includes('Secret review'));assert.ok(!JSON.stringify(rows).includes('local-test'));
 }finally{await f.mf.dispose();}
});
test('OAuth journey links to feedback with opaque state, terminal results and no identity in metrics',async()=>{
 const f=await fixture();try{
  await f.step('feedback','open',{game:'dodo'});const login=crypto.randomUUID();
  await f.step('login','open',{flow:login,attempt:login,parent:f.flow});
  const response=await f.call('/api/auth/github/login?return=room&flow='+login),url=new URL(response.headers.get('Location'));
  assert.equal(response.status,303);assert.ok(!url.href.includes(login));assert.ok(!url.href.includes(f.visitor));
  const state=url.searchParams.get('state'),headers={Cookie:'__Host-oag_admin_oauth='+state};
  assert.equal((await f.call('/api/auth/github/callback?code=test&state='+state,{headers})).status,303);
  let report=await f.report();assert.equal(report.families.find(r=>r.family==='login').success,1);assert.equal(report.families.find(r=>r.family==='feedback').authenticated,1);
  const second=crypto.randomUUID();await f.step('login','open',{flow:second,attempt:second});const again=await f.call('/api/auth/github/login?flow='+second);const state2=new URL(again.headers.get('Location')).searchParams.get('state');
  await f.call('/api/auth/github/callback?error=access_denied&state='+state2,{headers:{Cookie:'__Host-oag_admin_oauth='+state2}});
  report=await f.report();assert.equal(report.families.find(r=>r.family==='login').failed,1);
  assert.ok(!JSON.stringify((await f.db.prepare('SELECT * FROM analytics_steps').all()).results).includes('local-test'));
 }finally{await f.mf.dispose();}
});
test('Game runtime requires ready and start, time is cumulative and incomplete frames stay unconfirmed',async()=>{
 const f=await fixture();try{
  const props={game:'dodo'};await f.step('game','open',props);
  assert.equal((await f.step('game','active',{...props,durationMs:100})).status,409);
  await f.step('game','ready',{...props,durationMs:10});await f.step('game','start',props);
  for(const durationMs of [100,80,100])assert.equal((await f.step('game','active',{...props,durationMs})).status,204);
  assert.equal((await f.step('game','active',{...props,durationMs:800000})).status,400);
  const other=crypto.randomUUID();await f.step('game','open',{...props,flow:other,attempt:other});await f.step('game','timeout',{...props,flow:other,attempt:other,code:'timeout'});
  const g=(await f.report()).games[0];assert.equal(g.opened,2);assert.equal(g.ready,1);assert.equal(g.started,1);assert.equal(g.activeMs,100);assert.equal(g.unconfirmed,1);
 }finally{await f.mf.dispose();}
});
test('Exact-day retention waits for complete Shanghai days and deduplicates repeat views',async()=>{
 const f=await fixture();try{
  await f.db.prepare('DELETE FROM analytics_events').run();
  const midnight=Math.floor((Date.now()+28800000)/DAY)*DAY-28800000;
  for(const [visitor,days]of [['old',[9,8,2,2]],['recent',[1,0]],['new',[0]]])for(const d of days)await f.db.prepare('INSERT INTO analytics_events VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),visitor,'pageview','','','direct','desktop','openaigames.org',midnight-d*DAY+1000).run();
  const report=await flowReport(f.db,midnight-10*DAY,midnight+DAY,midnight+3600000);
  assert.deepEqual(report.retention,[{days:1,eligible:1,returned:1},{days:7,eligible:1,returned:1}]);
 }finally{await f.mf.dispose();}
});
test('Legacy submission outcomes require a verified relay before matching the legacy visit',async()=>{
 const f=await fixture();try{
  const legacy='https://openaigames.lens-frontier.workers.dev',visit=crypto.randomUUID(),flow=crypto.randomUUID(),attempt=crypto.randomUUID();
  assert.equal((await f.collect({kind:'pageview',version:2,id:visit},{Origin:legacy})).status,204);
  for(const [step,a]of [['open',flow],['attempt',attempt]])assert.equal((await f.collect({kind:'step',visit,flow,attempt:a,family:'submission',step},{Origin:legacy})).status,204);
  const headers={Origin:origin,'X-OAG-Telemetry':JSON.stringify({visitor:f.visitor,visit,flow,attempt})},envWithDB={...env,DB:f.db,BOARD_RELAY_SECRET:'test-relay-key'};
  const request=extra=>new Request(origin+'/api/submissions',{method:'POST',headers:{...headers,...extra},body:'{}'});
  await recordOutcome(request({}),envWithDB,new Response('{}',{status:201}));assert.equal((await f.db.prepare("SELECT COUNT(*) n FROM analytics_steps WHERE step='success'").first()).n,0);
  const encoder=new TextEncoder(),stamp=String(Date.now()),client='a'.repeat(64),key=await crypto.subtle.importKey('raw',encoder.encode(envWithDB.BOARD_RELAY_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(`POST\n/api/board\n${stamp}\n${client}`))),b=>b.toString(16).padStart(2,'0')).join('');
  await recordOutcome(request({'X-Board-Client':client,'X-Board-Time':stamp,'X-Board-Signature':signature}),envWithDB,new Response('{}',{status:201}));assert.equal((await f.db.prepare("SELECT COUNT(*) n FROM analytics_steps WHERE step='success'").first()).n,1);
 }finally{await f.mf.dispose();}
});
