import {json,readBody} from './board-http.js';
import {hash} from './admin-auth.js';
import {catalog} from './catalog.js';

const DAY=86400000,OFFSET=8*3600000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sources=['direct','wechat','xiaohongshu','github','x','bilibili','search','other'];
const hosts=['openaigames.org','openaigames.lens-frontier.workers.dev','openaigames.3325932294.workers.dev'];
const day=ms=>new Date(ms+OFFSET).toISOString().slice(0,10);
const enabled=env=>env.ANALYTICS_ENABLED==='1'&&env.CATALOG_MODE!=='preview'&&!env.BOARD_UPSTREAM&&env.DB&&env.ADMIN_SESSION_SECRET?.length>=32;
function acceptedOrigin(request){const origin=request.headers.get('Origin');if(!origin)return null;try{const url=new URL(origin),target=new URL(request.url);if(origin!==url.origin)return null;if(url.protocol==='https:'&&hosts.includes(url.hostname)&&!url.port)return origin;if(target.origin===origin&&url.hostname==='127.0.0.1')return origin;}catch{}return null;}
const empty=origin=>new Response(null,{status:204,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin'}});
async function publishedGames(request,env){
 const response=await catalog(new Request(new URL('/api/catalog',request.url)),env);
 if(!response.ok)throw Error('Catalog unavailable');
 const {projects=[]}=await response.json();
 const intake=(await env.DB.prepare("SELECT id,title,url FROM game_submissions WHERE status='approved'").all()).results;
 const entries=[...projects.map(p=>({id:p.id,title:p.title,url:p.preview_url})),...intake.map(p=>({id:'inbox-'+p.id,title:p.title,url:p.url}))];
 return entries.filter(p=>p.url);
}
export async function collectAnalytics(request,env){
 const origin=acceptedOrigin(request);
 if(!origin)return json({error:'Origin not allowed'},403);
 if(!enabled(env))return json({error:'Analytics unavailable'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'3600','Vary':'Origin'}});
 const respond=(data,status)=>json(data,status,{'Access-Control-Allow-Origin':origin,'Vary':'Origin'});
 if(request.method!=='POST')return respond({error:'Method not allowed'},405);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return respond({error:'JSON required'},415);
 // Best-effort browser metrics; do not record known crawlers or privacy opt-outs.
 if(request.headers.get('DNT')==='1'||request.headers.get('Sec-GPC')==='1'||/bot|crawler|spider|headless|lighthouse|preview/i.test(request.headers.get('User-Agent')||''))return empty(origin);
 const raw=await readBody(request);if(raw instanceof Response)return raw;
 let input;try{input=JSON.parse(raw);}catch{return respond({error:'Invalid event'},400);}
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['id','visitor','kind','game','source','device'].includes(k))||!UUID.test(input.id||'')||!UUID.test(input.visitor||'')||!['pageview','play'].includes(input.kind)||!sources.includes(input.source)||!['mobile','desktop'].includes(input.device)|| (input.kind==='play'?!/^[a-zA-Z0-9_-]{1,100}$/.test(input.game||''):input.game!==undefined))return respond({error:'Invalid event'},400);
 const now=Date.now(),visitor=await hash('analytics:visitor:'+env.ADMIN_SESSION_SECRET+':'+input.visitor);
 if(await env.DB.prepare('SELECT id FROM analytics_events WHERE id=? AND visitor=?').bind(input.id,visitor).first())return empty(origin);
 // Bounded per-minute address quota limits clients that keep changing visitor IDs.
 const address=await hash(`analytics:limit:${env.ADMIN_SESSION_SECRET}:${Math.floor(now/60000)}:${request.headers.get('CF-Connecting-IP')||'local'}`);
 const quota=await env.DB.prepare('INSERT INTO analytics_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 WHERE count<120 RETURNING count').bind(address,now+120000).first();
 if(!quota)return respond({error:'Too many events'},429);
 let gameKey='',gameTitle='';
 if(input.kind==='play'){
  const game=(await publishedGames(request,env)).find(g=>g.id===input.game);
  if(!game)return respond({error:'Game is not published'},404);
  gameKey=await hash(game.url);gameTitle=game.title;
 }
 const result=await env.DB.batch([
  env.DB.prepare('INSERT OR IGNORE INTO analytics_events(id,visitor,kind,game_key,game_title,source,device,host,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(input.id,visitor,input.kind,gameKey,gameTitle,input.source,input.device,new URL(origin).hostname,now),
  env.DB.prepare("INSERT OR IGNORE INTO analytics_meta(key,value) VALUES('started_at',?)").bind(now)
 ]);
 if(!result[0].meta.changes)return respond({error:'Event ID already used'},409);
 return empty(origin);
}
export function analyticsRange(params,now=Date.now()){
 const today=day(now),from=params.get('from')||day(now-6*DAY),to=params.get('to')||today;
 const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
 if(!date(from)||!date(to)||from>to||to>today||from<day(now-89*DAY))throw Error('请选择最近 90 天内的日期。');
 return {from,to,start:Date.parse(from+'T00:00:00Z')-OFFSET,end:Date.parse(to+'T00:00:00Z')-OFFSET+DAY};
}
export async function analyticsReport(request,env){
 if(!enabled(env))return json({error:'访问统计尚未启用。'},503);
 let range;try{range=analyticsRange(new URL(request.url).searchParams);}catch(e){return json({error:e.message},400);}
 const {start,end}=range,db=env.DB;
 const queries=[
  db.prepare("SELECT COALESCE(SUM(kind='pageview'),0) AS pageviews,COUNT(DISTINCT CASE WHEN kind='pageview' THEN visitor END) AS visitors,COALESCE(SUM(kind='play'),0) AS plays,COUNT(DISTINCT CASE WHEN kind='play' THEN visitor END) AS players FROM analytics_events WHERE created_at>=? AND created_at<?").bind(start,end),
  db.prepare("SELECT strftime('%Y-%m-%d',created_at/1000,'unixepoch','+8 hours') AS day,COALESCE(SUM(kind='pageview'),0) AS pageviews,COUNT(DISTINCT CASE WHEN kind='pageview' THEN visitor END) AS visitors,COALESCE(SUM(kind='play'),0) AS plays FROM analytics_events WHERE created_at>=? AND created_at<? GROUP BY day ORDER BY day").bind(start,end),
  db.prepare("SELECT game_key AS key,MAX(game_title) AS title,COUNT(*) AS plays,COUNT(DISTINCT visitor) AS players FROM analytics_events WHERE kind='play' AND created_at>=? AND created_at<? GROUP BY game_key ORDER BY plays DESC,game_key LIMIT 30").bind(start,end),
  ...['source','device','host'].map(field=>db.prepare(`SELECT ${field} AS name,COUNT(*) AS pageviews,COUNT(DISTINCT visitor) AS visitors FROM analytics_events WHERE kind='pageview' AND created_at>=? AND created_at<? GROUP BY ${field} ORDER BY pageviews DESC,${field}`).bind(start,end)),
  db.prepare('SELECT COUNT(*) AS count FROM game_submissions WHERE created_at>=? AND created_at<?').bind(start,end),
  db.prepare('SELECT COUNT(*) AS count FROM game_comments WHERE deleted_at IS NULL AND created_at>=? AND created_at<?').bind(start,end),
  db.prepare('SELECT COUNT(*) AS count FROM board_messages WHERE created_at>=? AND created_at<?').bind(start,end),
  db.prepare('SELECT COUNT(rating) AS ratings,COALESCE(SUM(liked),0) AS likes FROM game_reactions'),
  db.prepare("SELECT value FROM analytics_meta WHERE key='started_at'")
 ];
 const results=await db.batch(queries),rows=i=>results[i].results;
 const byDay=new Map(rows(1).map(r=>[r.day,r]));
 const daily=[];for(let time=start;time<end;time+=DAY){const key=day(time);daily.push(byDay.get(key)||{day:key,pageviews:0,visitors:0,plays:0});}
 return json({range:{from:range.from,to:range.to,timeZone:'Asia/Shanghai'},startedAt:rows(10)[0]?.value??null,summary:rows(0)[0],daily,games:rows(2),sources:rows(3),devices:rows(4),hosts:rows(5),engagement:{submissions:rows(6)[0].count,comments:rows(7)[0].count,notes:rows(8)[0].count,currentRatings:rows(9)[0].ratings,currentLikes:rows(9)[0].likes}});
}
export async function cleanupAnalytics(env,now=Date.now()){
 if(!env.DB||env.ANALYTICS_ENABLED!=='1')return;
 // Keep complete Shanghai calendar days for the available 90-day report window.
 const oldest=Date.parse(day(now-89*DAY)+'T00:00:00Z')-OFFSET;
 await env.DB.batch([env.DB.prepare('DELETE FROM analytics_events WHERE created_at<?').bind(oldest),env.DB.prepare('DELETE FROM analytics_limits WHERE expires_at<?').bind(now)]);
}
