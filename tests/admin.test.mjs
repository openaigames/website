import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
import {hash,encryptToken} from '../worker/admin-auth.js';
const origin='https://review.example.org';
const bindings={GITHUB_CLIENT_ID:'test-client',GITHUB_CLIENT_SECRET:'test-secret',ADMIN_SESSION_SECRET:'a'.repeat(64),ADMIN_ORIGIN:origin};
async function migrate(db,files){for(const file of files)for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();}
const allMigrations=(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort();
test('GitHub sessions, immutable admin identity, moderation privacy, CSRF and concurrent review',async()=>{
 let revoked=false;const tokens=new Map([['admin-token',{id:102272920,login:'mattheliu'}],['member-token',{id:888,login:'mattheliu'}]]);let codeUser='admin-token',lastExchange;
 const mf=new Miniflare({modules:true,scriptPath:resolve('dist/server/index.js'),compatibilityDate:'2026-05-15',d1Databases:['DB'],bindings,outboundService:async request=>{
  const url=new URL(request.url);
  if(url.href==='https://github.com/login/oauth/access_token'){lastExchange=await request.json();return Response.json({access_token:codeUser,expires_in:28800});}
  if(url.href==='https://api.github.com/user'){const token=request.headers.get('Authorization')?.slice(7);return revoked?Response.json({message:'Bad credentials'},{status:401}):Response.json(tokens.get(token)||{}, {status:tokens.has(token)?200:401});}
  throw Error('Unexpected outbound request '+url.origin+url.pathname);
 }});
 const call=(path,options={})=>mf.dispatchFetch(origin+path,{redirect:'manual',...options});
 try{
 const db=await mf.getD1Database('DB');await migrate(db,allMigrations);
 assert.equal((await call('/api/admin/submissions')).status,401);
 assert.equal((await call('/api/admin/submissions',{headers:{Cookie:'__Host-oag_admin_session=forged'}})).status,401);
 async function session(token,id,login){const raw=crypto.randomUUID().replaceAll('-','')+'12345678901',csrf=crypto.randomUUID();await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(await hash(raw),id,login,await encryptToken(token,bindings),csrf,Date.now()+3600000,Date.now()).run();return {Cookie:'__Host-oag_admin_session='+raw,'X-Admin-CSRF':csrf};}
 const admin=await session('admin-token',102272920,'mattheliu'),member=await session('member-token',888,'mattheliu');
 assert.equal((await (await call('/api/auth/session',{headers:member})).json()).user.isAdmin,false);
 assert.equal((await call('/api/admin/submissions',{headers:member})).status,403);
 const post=(path,data,headers=admin)=>call(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(data)});
 const intake=await post('/api/submissions',{requestId:crypto.randomUUID(),title:'<img src=x onerror=alert(1)>',url:'https://games.example.org/one',description:'A local integration test.',submitter:'Test player',relation:'creator',public:true});assert.equal(intake.status,201);const id=(await intake.json()).entry.id,path='/api/admin/submissions/'+id;
 assert.equal((await call('/api/submissions?id='+id)).status,404);assert.deepEqual((await(await call('/api/submissions')).json()).entries,[]);
 assert.equal((await post(path,{status:'approved',version:0,note:''},member)).status,403);
 assert.equal((await post(path,{status:'approved',version:0,note:''},{...admin,Origin:'https://evil.example'})).status,403);
 assert.equal((await post(path,{status:'approved',version:0,note:''},{...admin,'X-Admin-CSRF':'forged'})).status,403);
 assert.equal((await post(path,{status:'rejected',version:0,note:''})).status,400);
 assert.equal((await post(path,{status:'approved',version:0,note:'Tested'})).status,200);
 const published=await(await call('/api/submissions?id='+id)).json();assert.equal(published.entry.id,id);assert.equal(published.entry.review_note,undefined);
 assert.equal((await post(path,{status:'rejected',version:0,note:'stale'})).status,409);
 assert.equal((await post(path,{status:'archived',version:1,note:'Needs fixes'})).status,200);assert.equal((await call('/api/submissions?id='+id)).status,404);
 assert.equal((await post(path,{status:'pending',version:2,note:'Recheck'})).status,200);
 const raced=await Promise.all([post(path,{status:'approved',version:3,note:'ok'}),post(path,{status:'rejected',version:3,note:'issue'})]);assert.deepEqual(raced.map(r=>r.status).sort(),[200,409]);
 const record=await(await call(path,{headers:admin})).json();assert.equal(record.reviews.length,4);assert.equal(record.entry.review_version,4);
 const audit=await db.prepare('SELECT * FROM submission_reviews').all();assert.ok(audit.results.every(r=>r.actor_id===102272920));
 const stored=await db.prepare('SELECT * FROM admin_sessions').all();assert.ok(stored.results.every(r=>!['admin-token','member-token'].includes(r.token)));
 // OAuth requires matching HttpOnly state cookie, PKCE, single-use state and a fixed callback.
 const login=await call('/api/auth/github/login?return=room');assert.equal(login.status,303);const authorize=new URL(login.headers.get('Location'));assert.equal(authorize.origin,'https://github.com');assert.equal(authorize.searchParams.get('scope'),'');assert.equal(authorize.searchParams.get('code_challenge_method'),'S256');assert.equal(authorize.searchParams.get('redirect_uri'),origin+'/api/auth/github/callback');const state=authorize.searchParams.get('state'),cookie='__Host-oag_admin_oauth='+state;
 const bad=await call('/api/auth/github/callback?code=code&state='+state);assert.equal(bad.headers.get('Location'),'/admin?auth=state');
 const success=await call('/api/auth/github/callback?code=code&state='+state,{headers:{Cookie:cookie}});assert.equal(success.headers.get('Location'),'/');assert.equal(await hash(lastExchange.code_verifier),authorize.searchParams.get('code_challenge'));assert.equal(lastExchange.client_secret,'test-secret');const sessionCookie=success.headers.get('Set-Cookie');assert.match(sessionCookie,/HttpOnly/);assert.match(sessionCookie,/Secure/);assert.match(sessionCookie,/SameSite=Lax/);
 const replay=await call('/api/auth/github/callback?code=code&state='+state,{headers:{Cookie:cookie}});assert.equal(replay.headers.get('Location'),'/admin?auth=state');
 codeUser='member-token';const memberLogin=await call('/api/auth/github/login?return=https://evil.example');const memberState=new URL(memberLogin.headers.get('Location')).searchParams.get('state');const memberCallback=await call('/api/auth/github/callback?code=code&state='+memberState,{headers:{Cookie:'__Host-oag_admin_oauth='+memberState}});assert.equal(memberCallback.headers.get('Location'),'/admin');assert.match(memberCallback.headers.get('Set-Cookie'),/__Host-oag_admin_session=/);
 const memberCount=await db.prepare('SELECT COUNT(*) as count FROM admin_sessions WHERE github_id=888').first();assert.equal(memberCount.count,2);
 const expired=await call('/api/auth/github/login');const expiredState=new URL(expired.headers.get('Location')).searchParams.get('state');await db.prepare('UPDATE admin_oauth_states SET created_at=0 WHERE hash=?').bind(await hash(expiredState)).run();assert.equal((await call('/api/auth/github/callback?code=code&state='+expiredState,{headers:{Cookie:'__Host-oag_admin_oauth='+expiredState}})).headers.get('Location'),'/admin?auth=state');
 assert.equal((await post('/api/auth/logout',{},member)).status,200);assert.equal((await call('/api/auth/session',{headers:member})).status,401);
 revoked=true;assert.equal((await post(path,{status:'archived',version:4,note:'revoked'})).status,403);assert.equal((await call('/api/auth/session',{headers:admin})).status,401);
 }finally{await mf.dispose();}
});
test('Moderation migration preserves previous public submissions, but keeps new ones private',async()=>{
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("ok")}}',d1Databases:['DB']});try{const db=await mf.getD1Database('DB');await migrate(db,allMigrations.slice(0,-1));const insert=status=>db.prepare('INSERT INTO game_submissions(request_id,title,url,description,submitter,relation,status,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'Old game','https://games.example.org/'+status+'/'+crypto.randomUUID(),'d','a','creator',status,100).run();await insert('pending');await insert('archived');await migrate(db,allMigrations.slice(-1));const rows=(await db.prepare('SELECT status,reviewed_by FROM game_submissions ORDER BY id').all()).results;assert.deepEqual(rows,[{status:'approved',reviewed_by:'legacy-public'},{status:'archived',reviewed_by:null}]);await insert('pending');assert.equal((await db.prepare('SELECT status FROM game_submissions ORDER BY id DESC LIMIT 1').first()).status,'pending');}finally{await mf.dispose();}
});
test('Preview and unconfigured deployments cannot issue sessions',async()=>{for(const override of [{CATALOG_MODE:'preview'}, {GITHUB_CLIENT_SECRET:''}, {ADMIN_ORIGIN:'https://elsewhere.example.org'}]){const mf=new Miniflare({modules:true,scriptPath:resolve('dist/server/index.js'),compatibilityDate:'2026-05-15',d1Databases:['DB'],bindings:{...bindings,...override}});try{assert.ok([403,503].includes((await mf.dispatchFetch(origin+'/api/auth/github/login')).status));}finally{await mf.dispose();}}});
