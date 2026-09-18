import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
import {hash,encryptToken} from '../worker/admin-auth.js';
import {analyticsRange,cleanupAnalytics} from '../worker/analytics.js';
const origin='https://openaigames.org',legacy='https://openaigames.lens-frontier.workers.dev',DAY=86400000;
const bindings={ANALYTICS_ENABLED:'1',GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'test-secret',ADMIN_SESSION_SECRET:'a'.repeat(64),ADMIN_ORIGIN:origin};
const projects=[{id:'dodo',title:'Dodo',preview_url:'https://games.example.org/dodo'}];
async function fixture(override={}){
 const mf=new Miniflare({modules:true,scriptPath:resolve('dist/server/index.js'),compatibilityDate:'2026-05-15',d1Databases:['DB'],bindings:{...bindings,...override},serviceBindings:{ASSETS:()=>Response.json({projects})},outboundService:async()=>Response.json({id:102272920,login:'mattheliu'})});
 const db=await mf.getD1Database('DB');for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
 const call=(path,options={})=>mf.dispatchFetch(origin+path,options);
 const event=(data={},headers={})=>call('/api/analytics/event',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','User-Agent':'Mozilla/5.0','CF-Connecting-IP':'203.0.113.1',...headers},body:JSON.stringify({id:crypto.randomUUID(),visitor:crypto.randomUUID(),kind:'pageview',source:'direct',device:'desktop',...data})});
 const session=async id=>{const token=crypto.randomUUID().replaceAll('-','')+'12345678901';await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(await hash(token),id,id===102272920?'mattheliu':'member',await encryptToken('test-token',bindings),'csrf',Date.now()+3600000,Date.now()).run();return {Cookie:'__Host-oag_admin_session='+token};};
 return {mf,db,call,event,session};
}
test('Analytics counts reloads but deduplicates visitors and retry IDs; only admins may read',async()=>{
 const f=await fixture();try{
  const visitor=crypto.randomUUID(),id=crypto.randomUUID();
  assert.equal((await f.event({visitor,id})).status,204);assert.equal((await f.event({visitor,id})).status,204);
  assert.equal((await f.event({visitor})).status,204);
  assert.equal((await f.event({visitor,kind:'play',game:'dodo'})).status,204);
  assert.equal((await f.call('/api/admin/analytics')).status,401);
  assert.equal((await f.call('/api/admin/analytics',{headers:await f.session(888)})).status,403);
  const admin=await f.session(102272920),report=await(await f.call('/api/admin/analytics',{headers:admin})).json();
  assert.deepEqual(report.summary,{pageviews:2,visitors:1,plays:1,players:1,selections:0});assert.equal(report.games[0].title,'Dodo');assert.equal(report.sources[0].name,'direct');assert.ok(report.startedAt);
  const stored=(await f.db.prepare('SELECT * FROM analytics_events').all()).results;assert.equal(stored.length,3);assert.ok(stored.every(e=>e.visitor!==visitor));assert.ok(!JSON.stringify(stored).includes('203.0.113.1'));
  assert.equal((await f.event({id})).status,409);assert.equal((await f.call('/api/admin/analytics?from=2020-01-01',{headers:admin})).status,400);
 }finally{await f.mf.dispose();}
});
test('Analytics validates published games, cross-origin collection, privacy and bounded input',async()=>{
 const f=await fixture();try{
  assert.equal((await f.event({}, {Origin:'https://evil.example'})).status,403);
  assert.equal((await f.event({}, {Origin:'null'})).status,403);
  assert.equal((await f.event({source:'someone@example.com'})).status,400);
  assert.equal((await f.event({referrer:'https://private.example/?secret=1'})).status,400);
  assert.equal((await f.event({id:'bad'})).status,400);
  assert.equal((await f.event({kind:'play',game:'unknown'})).status,404);
  await f.db.prepare("INSERT INTO game_submissions(request_id,title,url,description,submitter,relation,status,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),'Private','https://games.example.org/private','d','a','creator','pending',Date.now()).run();
  assert.equal((await f.event({kind:'play',game:'inbox-1'})).status,404);
  for(const headers of [{DNT:'1'},{'Sec-GPC':'1'},{'User-Agent':'Googlebot'}])assert.equal((await f.event({},headers)).status,204);
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM analytics_events').first()).n,0);
  const cors=await f.call('/api/analytics/event',{method:'OPTIONS',headers:{Origin:legacy}});assert.equal(cors.status,204);assert.equal(cors.headers.get('Access-Control-Allow-Origin'),legacy);
  const accepted=await f.event({source:'wechat'}, {Origin:legacy});assert.equal(accepted.status,204);assert.equal(accepted.headers.get('Access-Control-Allow-Origin'),legacy);assert.equal(accepted.headers.get('Access-Control-Allow-Credentials'),null);
  assert.equal((await f.db.prepare('SELECT host FROM analytics_events').first()).host,new URL(legacy).hostname);
  const key=await hash(`analytics:limit:${bindings.ADMIN_SESSION_SECRET}:${Math.floor(Date.now()/60000)}:203.0.113.2`);await f.db.prepare('INSERT INTO analytics_limits VALUES(?,120,?)').bind(key,Date.now()+120000).run();
  assert.equal((await f.event({}, {'CF-Connecting-IP':'203.0.113.2'})).status,429);
 }finally{await f.mf.dispose();}
});
test('Date reports use Shanghai calendar days, period UV and current reaction totals',async()=>{
 const f=await fixture();try{
  const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10),start=Date.parse(today+'T00:00:00Z')-8*3600000;
  for(const [id,time] of [['one',start+10],['two',start-DAY+10]])await f.db.prepare('INSERT INTO analytics_events VALUES(?,?,?,?,?,?,?,?,?)').bind(id,'same-visitor','pageview','','','direct','desktop','openaigames.org',time).run();
  await f.db.prepare('INSERT INTO game_reactions(game_key,github_id,rating,liked,updated_at) VALUES(?,?,?,?,?)').bind('game',42,5,1,start-7*DAY).run();
  const admin=await f.session(102272920),report=await(await f.call('/api/admin/analytics',{headers:admin})).json();
  assert.equal(report.summary.visitors,1);assert.equal(report.daily.reduce((n,d)=>n+d.visitors,0),2);assert.equal(report.engagement.currentLikes,1);assert.equal(report.engagement.currentRatings,1);
  const one=await(await f.call('/api/admin/analytics?'+new URLSearchParams({from:today,to:today}),{headers:admin})).json();assert.equal(one.summary.pageviews,1);assert.equal(one.daily.length,1);
  const range=analyticsRange(new URLSearchParams({from:'2026-09-16',to:'2026-09-17'}),Date.parse('2026-09-17T10:00:00Z'));assert.equal(range.start,Date.parse('2026-09-15T16:00:00Z'));assert.equal(range.end,Date.parse('2026-09-17T16:00:00Z'));
  assert.throws(()=>analyticsRange(new URLSearchParams({from:'2026-02-30',to:'2026-03-01'}),Date.parse('2026-03-02T00:00:00Z')));
  await f.db.prepare('INSERT INTO analytics_events VALUES(?,?,?,?,?,?,?,?,?)').bind('old','old','pageview','','','direct','desktop','openaigames.org',start-90*DAY).run();
  await cleanupAnalytics({DB:f.db,ANALYTICS_ENABLED:'1'});assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM analytics_events').first()).n,2);
 }finally{await f.mf.dispose();}
});
test('Analytics shares game identity after catalog promotion and never enables preview collection',async()=>{
 const f=await fixture();try{
  await f.db.prepare("INSERT INTO game_submissions(request_id,title,url,description,submitter,relation,status,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),'Dodo demo',projects[0].preview_url,'d','a','creator','approved',Date.now()).run();
  const visitor=crypto.randomUUID();await f.event({visitor,kind:'play',game:'inbox-1'});await f.event({visitor,kind:'play',game:'dodo'});
  const report=await(await f.call('/api/admin/analytics',{headers:await f.session(102272920)})).json();assert.equal(report.games.length,1);assert.equal(report.games[0].plays,2);assert.equal(report.games[0].players,1);
 }finally{await f.mf.dispose();}
 for(const config of [{CATALOG_MODE:'preview'},{ANALYTICS_ENABLED:'0'},{ADMIN_SESSION_SECRET:''}]){const f=await fixture(config);try{assert.equal((await f.event()).status,403);assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM analytics_events').first()).n,0);}finally{await f.mf.dispose();}}
});
test('Explicit selections use published identity but do not create opens or page views',async()=>{
 const f=await fixture();try{
  const visitor=crypto.randomUUID(),id=crypto.randomUUID();
  assert.equal((await f.event({id,visitor,kind:'select',game:'dodo'})).status,204);
  assert.equal((await f.event({id,visitor,kind:'select',game:'dodo'})).status,204);
  assert.equal((await f.event({visitor,kind:'select',game:'unpublished'})).status,404);
  const report=await(await f.call('/api/admin/analytics',{headers:await f.session(102272920)})).json();
  assert.deepEqual(report.summary,{pageviews:0,visitors:0,plays:0,players:0,selections:1});assert.equal(report.games[0].selections,1);assert.equal(report.games[0].plays,0);assert.equal(report.games[0].players,0);
 }finally{await f.mf.dispose();}
});
test('Active duration is cumulative, visit-bound, bounded and excludes old-client visits from averages',async()=>{
 const f=await fixture();try{
  const visitor=crypto.randomUUID(),visit=crypto.randomUUID();
  await f.event({visitor}); // Old client: no eligible timed visit.
  assert.equal((await f.event({id:visit,visitor,version:2})).status,204);
  assert.equal((await f.event({id:visit,visitor,version:2})).status,204);
  await f.event({visitor,version:2}); // Zero-duration visit must remain in denominator.
  await f.db.prepare('UPDATE analytics_visits SET created_at=created_at-60000 WHERE id=?').bind(visit).run();
  const heartbeat={visitor,kind:'engagement',visit,activeMs:30000};
  assert.equal((await f.event(heartbeat)).status,204);assert.equal((await f.event(heartbeat)).status,204);
  assert.equal((await f.event({...heartbeat,activeMs:15000})).status,204); // Late delivery does not reduce the total.
  for(const value of [-1,1.5,'30000',DAY+1])assert.equal((await f.event({...heartbeat,activeMs:value})).status,400);
  assert.equal((await f.event({...heartbeat,activeMs:120000})).status,400);
  assert.equal((await f.event({...heartbeat,visitor:crypto.randomUUID()})).status,404);
  assert.equal((await f.event(heartbeat,{Origin:legacy})).status,404);
  assert.equal((await f.event({...heartbeat,visit:crypto.randomUUID()})).status,404);
  assert.equal((await f.event({...heartbeat,game:'dodo'})).status,400);
  assert.equal((await f.event({activeMs:1})).status,400);
  assert.equal((await f.event({kind:'select',game:'dodo',version:2})).status,400);
  const admin=await f.session(102272920),report=await(await f.call('/api/admin/analytics',{headers:admin})).json();
  assert.deepEqual(report.attention,{visits:2,totalActiveMs:30000,avgActiveMs:15000});assert.ok(report.engagementStartedAt);assert.equal(report.summary.pageviews,3);
  assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM analytics_events').first()).n,3);
  // A period with no timing-capable visits is explicitly empty, not a fake zero-second average of old traffic.
  const yesterday=new Date(Date.now()+8*3600000-DAY).toISOString().slice(0,10);
  const empty=await(await f.call('/api/admin/analytics?'+new URLSearchParams({from:yesterday,to:yesterday}),{headers:admin})).json();assert.equal(empty.attention.visits,0);
  await f.db.prepare('UPDATE analytics_visits SET created_at=? WHERE id=?').bind(Date.now()-91*DAY,visit).run();
  await cleanupAnalytics({DB:f.db,ANALYTICS_ENABLED:'1'});assert.equal((await f.db.prepare('SELECT COUNT(*) AS n FROM analytics_visits').first()).n,1);
 }finally{await f.mf.dispose();}
});
