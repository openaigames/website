import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
import {hash,encryptToken,safeReturn} from '../worker/admin-auth.js';

test('Game feedback validates identity, scores, deduplication, aggregates, privacy and deletion',async()=>{
 const origin='https://comments.example.org',bindings={GITHUB_CLIENT_ID:'test',GITHUB_CLIENT_SECRET:'test',ADMIN_SESSION_SECRET:'t'.repeat(64),ADMIN_ORIGIN:origin};
 let revoked=false;
 const catalog={projects:[{id:'dodo',preview_url:'https://games.example.org/dodo'}]};
 const mf=new Miniflare({modules:true,scriptPath:resolve('dist/server/index.js'),compatibilityDate:'2026-05-15',d1Databases:['DB'],bindings,serviceBindings:{ASSETS:()=>Response.json(catalog)},outboundService:request=>{
  const id=Number(request.headers.get('Authorization')?.replace('Bearer token-',''));
  return revoked?Response.json({},{status:401}):Response.json({id,login:'member-'+id});
 }});
 try{
  const db=await mf.getD1Database('DB');for(const f of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+f,'utf8')).split('--> statement-breakpoint'))if(sql.trim())await db.prepare(sql).run();
  const call=(query='',options={})=>mf.dispatchFetch(origin+'/api/comments?game=dodo'+query,{redirect:'manual',...options});
  async function session(id){const raw=crypto.randomUUID().replaceAll('-','')+'12345678901',csrf=crypto.randomUUID();await db.prepare('INSERT INTO admin_sessions VALUES(?,?,?,?,?,?,?)').bind(await hash(raw),id,'member-'+id,await encryptToken('token-'+id,bindings),csrf,Date.now()+3600000,Date.now()).run();return {Cookie:'__Host-oag_admin_session='+raw,'X-Admin-CSRF':csrf};}
  const member=await session(100),other=await session(101),admin=await session(102272920);
  const post=(input,headers=member,query='')=>call(query,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(input)});
  const input={body:'<img src=x onerror=alert(1)> A real comment',requestId:crypto.randomUUID(),login:'spoofed',github_id:102272920};
  assert.deepEqual((await(await call()).json()).entries,[]);
  assert.equal((await post(input,{})).status,401);
  assert.equal((await post(input,{...member,Origin:'https://evil.example'})).status,403);
  assert.equal((await post(input,{...member,'X-Admin-CSRF':'wrong'})).status,403);
  assert.equal((await post({...input,body:' '})).status,400);
  assert.equal((await post({...input,body:'x'.repeat(1001)})).status,400);
  const response=await post(input);assert.equal(response.status,201);const {entry}=await response.json();assert.equal(entry.github_id,100);assert.equal(entry.login,'member-100');assert.equal(entry.body,input.body);assert.equal(entry.request_id,undefined);
  // Aggregate counts stay public; personal selections require the authenticated viewer.
  assert.equal((await call('&mine=1')).status,401);
  const empty=(await(await call('&view=summary')).json());assert.deepEqual(empty,{summary:{average:null,ratingCount:0,likes:0,commentCount:1},viewer:null});
  for(const rating of [0,6,1.5,'5',true,undefined])assert.equal((await post({action:'rate',rating})).status,400);
  assert.equal((await post({action:'like',liked:'true'})).status,400);
  assert.equal((await post({action:'rate',rating:5},{})).status,401);
  assert.equal((await post({action:'like',liked:true},{...member,'X-Admin-CSRF':'wrong'})).status,403);
  assert.equal((await post({action:'rate',rating:5},{...member,Origin:'https://evil.example'})).status,403);
  let reacted=await(await post({action:'rate',rating:5,github_id:101})).json();assert.deepEqual(reacted.viewer,{rating:5,liked:false});assert.equal(reacted.summary.average,5);assert.equal(reacted.summary.ratingCount,1);
  await post({action:'rate',rating:5});assert.equal((await(await call()).json()).summary.ratingCount,1,'retries cannot add votes');
  await post({action:'like',liked:true});await post({action:'like',liked:true});
  reacted=await(await call('&mine=1',{headers:member})).json();assert.deepEqual(reacted.viewer,{rating:5,liked:true});assert.equal(reacted.summary.likes,1);
  assert.equal((await(await call('',{headers:member})).json()).viewer,null,'public responses never disclose a personal selection');
  await post({action:'rate',rating:2},other);reacted=await(await call()).json();assert.equal(reacted.summary.average,3.5);assert.equal(reacted.summary.ratingCount,2);
  reacted=await(await post({action:'rate',rating:4})).json();assert.equal(reacted.summary.average,3);assert.equal(reacted.summary.ratingCount,2);assert.equal(reacted.viewer.liked,true,'changing a rating keeps the like');
  reacted=await(await post({action:'like',liked:false})).json();assert.equal(reacted.summary.likes,0);assert.equal(reacted.viewer.rating,4,'unliking keeps the rating');
  reacted=await(await post({action:'rate',rating:null})).json();assert.equal(reacted.summary.average,2);assert.equal(reacted.summary.ratingCount,1);
  await post({action:'rate',rating:null},other);assert.equal((await(await call()).json()).summary.average,null,'no ratings must not display zero stars');
  await post({action:'rate',rating:5});await post({action:'like',liked:true});
  assert.equal((await(await post(input)).json()).duplicate,true);
  assert.equal((await post({...input,body:'Changed'})).status,409);
  assert.equal((await post({...input,requestId:crypto.randomUUID()})).status,429);
  assert.equal((await(await call()).json()).entries.length,1);
  assert.equal((await call('&before=bad')).status,400);
  assert.equal((await call('&before='+entry.id)).status,200);assert.equal((await(await call('&before='+entry.id)).json()).entries.length,0);
  assert.equal((await post({action:'delete',id:entry.id},other)).status,404);
  // The same public URL keeps its comments when promoted from an intake entry.
  const seeded=await db.prepare("INSERT INTO game_submissions(request_id,title,url,description,submitter,relation,status,created_at) VALUES(?,?,?,?,?,?,'approved',?)").bind(crypto.randomUUID(),'Dodo','https://games.example.org/dodo','d','a','creator',Date.now()).run();
  const id=seeded.meta.last_row_id;
  const inbox=path=>mf.dispatchFetch(origin+'/api/comments?game=inbox-'+id+path);
  const promoted=await(await inbox('')).json();assert.equal(promoted.entries[0].id,entry.id);assert.equal(promoted.summary.average,5);assert.equal(promoted.summary.likes,1);
  await db.prepare("UPDATE game_submissions SET status='pending' WHERE id=?").bind(id).run();assert.equal((await inbox('')).status,404);
  assert.equal((await mf.dispatchFetch(origin+'/api/comments?game=missing')).status,404);
  assert.equal((await post({action:'delete',id:entry.id})).status,200);assert.equal((await(await call()).json()).entries.length,0);
  const second=await(await post({body:'Another member',requestId:crypto.randomUUID()},other)).json();assert.equal((await post({action:'delete',id:second.entry.id},admin)).status,200);
  assert.equal((await(await call()).json()).entries.length,0);assert.equal((await(await call()).json()).summary.commentCount,0);
  revoked=true;assert.equal((await post({body:'revoked',requestId:crypto.randomUUID()})).status,403);
 }finally{await mf.dispose();}
});

test('OAuth return destinations preserve comment context but cannot leave the site',()=>{
 for(const path of ['/?lang=en#/comments/dodo','/?lang=zh#/comments/inbox-12','/#/title/dodo','/'])assert.equal(safeReturn(path),path);
 for(const path of ['https://evil.example','//evil.example','/\\evil.example','/%2f%2fevil.example','/?redirect=evil','/#/comments/<script>'])assert.equal(safeReturn(path),'/admin');
 assert.equal(safeReturn('room'),'/');
});
