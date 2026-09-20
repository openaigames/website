import {clientKey} from './board-relay.js';
import {hash} from './admin-auth.js';
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const flowsEnabled=env=>env.ANALYTICS_ENABLED==='1'&&env.CATALOG_MODE!=='preview'&&!env.BOARD_UPSTREAM&&env.DB&&env.ADMIN_SESSION_SECRET?.length>=32;
const privateRequest=request=>request.headers.get('DNT')==='1'||request.headers.get('Sec-GPC')==='1'||/bot|crawler|spider|headless|lighthouse|preview/i.test(request.headers.get('User-Agent')||'');
const steps={room:['open','ready','error','timeout'],submission:['open','input','attempt','error'],feedback:['open','attempt','error'],login:['open'],search:['open','results','select'],game:['open','ready','start','active','exit','timeout','error']};
const codes=['','network','http','unauthorized','rate_limited','invalid','server','aborted','webgl','resource','timeout','rate','unrate','like','unlike','comment','denied','github','state'];
export function validStep(input){
 return (!['feedback','game'].includes(input.family)||typeof input.game==='string')&&UUID.test(input.flow||'')&&UUID.test(input.attempt||'')&&UUID.test(input.visit||'')&&(!input.parent||UUID.test(input.parent))&&steps[input.family]?.includes(input.step)&&codes.includes(input.code||'')&&Number.isSafeInteger(input.durationMs??0)&&(input.durationMs??0)>=0&&(input.durationMs??0)<=86400000&&Number.isSafeInteger(input.resultCount??0)&&(input.resultCount??0)>=0&&(input.resultCount??0)<=10000;
}
const insert=(db,row)=>db.prepare('INSERT OR IGNORE INTO analytics_steps(id,visitor,visit,flow,parent,attempt,family,step,game_key,game_title,device,host,duration_ms,result_count,code,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(row.id,row.visitor,row.visit,row.flow,row.parent||'',row.attempt,row.family,row.step,row.game_key||'',row.game_title||'',row.device,row.host,row.durationMs||0,row.resultCount||0,row.code||'',row.created_at);
export async function recordStep(env,input,visitor,host,game){
 const now=Date.now();
 const visit=await env.DB.prepare("SELECT e.device,v.created_at FROM analytics_visits v JOIN analytics_events e ON e.id=v.id WHERE v.id=? AND v.visitor=? AND v.host=?").bind(input.visit,visitor,host).first();
 if(!visit||now-visit.created_at>86400000)return 404;
 const first=await env.DB.prepare('SELECT * FROM analytics_steps WHERE flow=? ORDER BY created_at,id LIMIT 1').bind(input.flow).first();
 if(first&&(first.visitor!==visitor||first.visit!==input.visit||first.family!==input.family||first.host!==host||first.game_key!==(game?.key||'')))return 409;
 if(input.step!=='open'&&!first)return 409;
 if(input.parent){const parent=await env.DB.prepare("SELECT id FROM analytics_steps WHERE flow=? AND visitor=? AND family='feedback'").bind(input.parent,visitor).first();if(!parent)return 400;}
 if(input.durationMs>now-visit.created_at+10000)return 400;
 if(['ready','start','active','exit'].includes(input.step)&&input.family==='game'){
  const seen=(await env.DB.prepare('SELECT step FROM analytics_steps WHERE flow=?').bind(input.flow).all()).results.map(r=>r.step);
  if(['start','active'].includes(input.step)&&!seen.includes('ready'))return 409;
  if(input.step==='active'&&!seen.includes('start'))return 409;
 }
 const row={...input,visitor,host,device:visit.device,created_at:now,game_key:game?.key,game_title:game?.title};
 if(input.step==='active'){
  const existing=await env.DB.prepare("SELECT duration_ms FROM analytics_steps WHERE flow=? AND attempt=? AND step='active'").bind(input.flow,input.attempt).first();
  if(existing){await env.DB.prepare("UPDATE analytics_steps SET duration_ms=MAX(duration_ms,?) WHERE flow=? AND attempt=? AND step='active'").bind(input.durationMs,input.flow,input.attempt).run();return 204;}
 }
 await env.DB.batch([insert(env.DB,row),env.DB.prepare("INSERT OR IGNORE INTO analytics_meta(key,value) VALUES('flows_started_at',?)").bind(now)]);
 return 204;
}
// Business outcomes come only from the actual handler response; telemetry never gates a write.
export async function recordOutcome(request,env,response){
 if(request.method!=='POST'||!flowsEnabled(env)||privateRequest(request)||request.headers.get('Origin')!==new URL(request.url).origin)return true;
 const raw=request.headers.get('X-OAG-Telemetry');if(!raw||raw.length>500)return true;
 let context;try{context=JSON.parse(raw);}catch{return true;}
 if(!context||!['visitor','visit','flow','attempt'].every(k=>UUID.test(context[k]||'')))return true;
 const family=new URL(request.url).pathname==='/api/submissions'?'submission':'feedback';
 const visitor=await hash('analytics:visitor:'+env.ADMIN_SESSION_SECRET+':'+context.visitor);
 const prior=await env.DB.prepare("SELECT * FROM analytics_steps WHERE flow=? AND attempt=? AND step='attempt' AND family=? AND visitor=? AND visit=?").bind(context.flow,context.attempt,family,visitor,context.visit).first();
 if(!prior)return false;
 const sameHost=prior.host===new URL(request.url).hostname;
 const relayed=family==='submission'&&prior.host==='openaigames.lens-frontier.workers.dev'&&request.headers.has('X-Board-Signature')&&await clientKey(request,env,Date.now());
 if(!sameHost&&!relayed)return true;
 const status=response.status;
 await insert(env.DB,{...prior,id:crypto.randomUUID(),step:response.ok?'success':'error',created_at:Date.now(),code:response.ok?prior.code:status===429?'rate_limited':[401,403].includes(status)?'unauthorized':status>=500?'server':'invalid'}).run();
 return true;
}
export async function trackedWrite(request,env,run,ctx){
 const response=await run();
 try{if(!await recordOutcome(request,env,response)&&ctx)ctx.waitUntil((async()=>{for(const delay of [150,500,1500]){await new Promise(r=>setTimeout(r,delay));if(await recordOutcome(request,env,response))return;}})().catch(()=>console.warn('Analytics outcome unavailable')));}catch{console.warn('Analytics outcome unavailable');}
 return response;
}
// An opaque, short-lived flow reference is kept in OAuth state, never sent to GitHub.
export async function loginFlow(request,env){
 if(!flowsEnabled(env)||privateRequest(request))return '';
 const flow=new URL(request.url).searchParams.get('flow');if(!UUID.test(flow||''))return '';
 const row=await env.DB.prepare("SELECT flow FROM analytics_steps WHERE flow=? AND family='login' AND step='open' AND host=? AND created_at>?").bind(flow,new URL(request.url).hostname,Date.now()-600000).first();return row?.flow||'';
}
export async function authOutcome(env,flow,step,code=''){
 if(!flowsEnabled(env)||!UUID.test(flow||''))return;
 try{const row=await env.DB.prepare("SELECT * FROM analytics_steps WHERE flow=? AND family='login' AND step='open'").bind(flow).first();if(row)await insert(env.DB,{...row,id:crypto.randomUUID(),step,code,created_at:Date.now()}).run();}catch{console.warn('Analytics login outcome unavailable');}
}
export async function flowReport(db,start,end,now=Date.now()){
 const q=(sql,...args)=>db.prepare(sql).bind(...args);
 // A cohort is the set of journeys opened in range; later steps count only through the report end.
 const cohort=`WITH journeys AS (SELECT * FROM analytics_steps WHERE step='open' AND created_at>=? AND created_at<?), stages AS (SELECT j.flow,j.family,j.device,j.game_title,j.game_key,MAX(s.step='input') AS input,MAX(s.step='attempt') AS attempted,MAX(s.step='success') AS success,MAX(s.step='error') AS error,MAX(s.step='ready') AS ready,MAX(s.step='start') AS started,SUM(s.step='start') AS rounds,MAX(s.step='timeout') AS timeout,MAX(s.step='select') AS selected,MAX(s.step='exit') AS exited,MAX(CASE WHEN s.step='results' THEN s.result_count ELSE -1 END) AS results,MAX(CASE WHEN s.step='ready' THEN s.duration_ms END) AS load_ms,MAX(CASE WHEN s.step='active' THEN s.duration_ms ELSE 0 END) AS active_ms,MAX(EXISTS(SELECT 1 FROM analytics_steps l WHERE l.parent=j.flow AND l.family='login' AND l.step='success' AND l.created_at<?)) AS authenticated FROM journeys j LEFT JOIN analytics_steps s ON s.flow=j.flow AND s.created_at<? GROUP BY j.flow)`;
 const [families,room,games,actions,errors,meta]=await db.batch([
  q(cohort+` SELECT family,COUNT(*) AS opened,SUM(input) AS input,SUM(attempted) AS attempted,SUM(success) AS success,SUM(error AND NOT success) AS failed,SUM(authenticated) AS authenticated,SUM(selected) AS selected,SUM(results=0) AS noResults,SUM(results>=0) AS searches FROM stages GROUP BY family`,start,end,end,end),
  q(cohort+` SELECT device,COUNT(*) AS opened,SUM(ready) AS ready,SUM(error) AS errors,SUM(NOT ready AND NOT error) AS unconfirmed,ROUND(AVG(load_ms)) AS avgLoadMs FROM stages WHERE family='room' GROUP BY device`,start,end,end,end),
  q(cohort+` SELECT game_key AS key,MAX(game_title) AS title,COUNT(*) AS opened,SUM(ready) AS ready,SUM(started) AS started,SUM(rounds) AS rounds,SUM(exited) AS exited,SUM(active_ms) AS activeMs,SUM(NOT ready) AS unconfirmed FROM stages WHERE family='game' GROUP BY game_key ORDER BY opened DESC LIMIT 30`,start,end,end,end),
  q(`SELECT a.code,COUNT(*) AS attempted,SUM(EXISTS(SELECT 1 FROM analytics_steps s WHERE s.flow=a.flow AND s.attempt=a.attempt AND s.step='success' AND s.created_at<?)) AS saved FROM analytics_steps a WHERE a.family='feedback' AND a.step='attempt' AND a.created_at>=? AND a.created_at<? GROUP BY a.code`,end,start,end),
  q(`SELECT family,code,COUNT(*) AS count FROM analytics_steps WHERE step='error' AND created_at>=? AND created_at<? GROUP BY family,code ORDER BY count DESC LIMIT 30`,start,end),
  db.prepare("SELECT value FROM analytics_meta WHERE key='flows_started_at'")
 ]);
 const today=Math.floor((now+28800000)/86400000),lastComplete=Math.min(today-1,Math.floor((end+28800000)/86400000)-1);
 // First observed within retained history, not a claim of first-ever users. Ignore today's partial return window.
 const retention=[];
 for(const days of [1,7]){
  const row=await q(`WITH firsts AS (SELECT visitor,MIN(CAST((created_at+28800000)/86400000 AS INTEGER)) AS first_day FROM analytics_events WHERE kind='pageview' GROUP BY visitor), eligible AS (SELECT * FROM firsts WHERE first_day>=? AND first_day<? AND first_day+?<=?) SELECT COUNT(*) AS eligible,COALESCE(SUM(EXISTS(SELECT 1 FROM analytics_events e WHERE e.visitor=eligible.visitor AND e.kind='pageview' AND CAST((e.created_at+28800000)/86400000 AS INTEGER)=eligible.first_day+?)),0) AS returned FROM eligible`,Math.floor((start+28800000)/86400000),Math.floor((end+28800000)/86400000),days,lastComplete,days).first();retention.push({days,...row});
 }
 return {startedAt:meta.results[0]?.value||null,families:families.results,room:room.results,games:games.results,actions:actions.results,errors:errors.results,retention};
}
