import {json,readBody} from './board-http.js';
import {adminIdentity,isAdministrator,login,callback,logout} from './admin-auth.js';
const fields='id,title,url,description,submitter,relation,status,created_at,review_version,reviewed_at,reviewed_by,review_note';
const transitions={pending:['approved','rejected'],approved:['archived'],rejected:['pending'],archived:['pending','approved']};
export async function admin(request,env){
 const url=new URL(request.url),path=url.pathname;
 if(env.CATALOG_MODE==='preview'||env.BOARD_UPSTREAM)return json({error:'预览站不开放管理后台。'},403);
 if(request.method==='GET'&&path==='/api/auth/github/login')return login(request,env);
 if(request.method==='GET'&&path==='/api/auth/github/callback')return callback(request,env);
 if(!['GET','POST'].includes(request.method))return json({error:'不支持这个操作。'},405);
 if(request.method==='POST'&&(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json')))return json({error:'请从审核后台提交操作。'},403);
 const identity=await adminIdentity(request,env);if(identity instanceof Response)return identity;
 if(request.method==='POST'&&request.headers.get('X-Admin-CSRF')!==identity.csrf)return json({error:'操作校验失败，请刷新页面。'},403);
 if(path==='/api/auth/session'&&request.method==='GET')return json({user:{id:identity.github_id,login:identity.login,isAdmin:isAdministrator(identity)},csrf:identity.csrf,expiresAt:identity.expires_at});
 if(path==='/api/auth/logout'&&request.method==='POST')return logout(request,env,identity);
 if(!isAdministrator(identity))return json({error:'当前账号没有审核权限。'},403);
 if(path==='/api/admin/submissions'&&request.method==='GET'){
  const status=url.searchParams.get('status')||'pending',q=url.searchParams.get('q')||'',before=url.searchParams.get('before');
  if(!['all',...Object.keys(transitions)].includes(status)||q.length>100||(before&&!/^[1-9]\d{0,14}$/.test(before)))return json({error:'查询条件无效。'},400);
  const where="(?='all' OR status=?) AND id<? AND instr(lower(title||' '||description||' '||submitter),lower(?))>0";
  const entries=(await env.DB.prepare(`SELECT ${fields} FROM game_submissions WHERE ${where} ORDER BY id DESC LIMIT 31`).bind(status,status,before?Number(before):Number.MAX_SAFE_INTEGER,q).all()).results;
  const counts=(await env.DB.prepare('SELECT status,COUNT(*) AS count FROM game_submissions GROUP BY status').all()).results;
  return json({entries:entries.slice(0,30),next:entries.length>30?entries[29].id:null,counts:Object.fromEntries(counts.map(r=>[r.status,r.count]))});
 }
 const match=path.match(/^\/api\/admin\/submissions\/([1-9]\d{0,14})$/);
 if(!match)return json({error:'找不到这个入口。'},404);
 const id=Number(match[1]),entry=await env.DB.prepare(`SELECT ${fields} FROM game_submissions WHERE id=?`).bind(id).first();
 if(!entry)return json({error:'投稿不存在。'},404);
 if(request.method==='GET'){
  const reviews=(await env.DB.prepare('SELECT from_status,to_status,actor_login,note,created_at FROM submission_reviews WHERE submission_id=? ORDER BY created_at DESC,id DESC LIMIT 100').bind(id).all()).results;
  return json({entry,reviews});
 }
 const raw=await readBody(request);if(raw instanceof Response)return raw;let input;try{input=JSON.parse(raw);}catch{return json({error:'操作格式无效。'},400);}
 if(!input||typeof input!=='object'||typeof input.note!=='string'||input.note.length>500||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(input.note)||!Number.isSafeInteger(input.version))return json({error:'请检查审核说明，最多 500 字。'},400);
 if(input.version!==entry.review_version)return json({error:'这条投稿已被处理，请刷新后再操作。'},409);
 if(!transitions[entry.status]?.includes(input.status))return json({error:'当前状态不支持这个操作。'},409);
 if(['rejected','archived'].includes(input.status)&&!input.note.trim())return json({error:'请填写驳回或下架原因。'},400);
 const now=Date.now(),note=input.note.trim();
 const result=await env.DB.batch([
  env.DB.prepare('INSERT INTO submission_reviews(id,submission_id,from_status,to_status,actor_id,actor_login,note,created_at) SELECT ?,id,status,?,?,?,?,? FROM game_submissions WHERE id=? AND review_version=?').bind(crypto.randomUUID(),input.status,identity.github_id,identity.login,note,now,id,input.version),
  env.DB.prepare('UPDATE game_submissions SET status=?,review_version=review_version+1,reviewed_at=?,reviewed_by=?,review_note=? WHERE id=? AND review_version=?').bind(input.status,now,identity.login,note,id,input.version)
 ]);
 if(result[1].meta.changes!==1)return json({error:'这条投稿已被处理，请刷新后再操作。'},409);
 return json({entry:await env.DB.prepare(`SELECT ${fields} FROM game_submissions WHERE id=?`).bind(id).first()});
}
export async function adminPage(request,env){
 if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'不支持这个操作。'},405);
 const response=await env.ASSETS.fetch(new Request(new URL('/static/admin/',request.url),request));
 const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag','noindex, nofollow');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');
 headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-src https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 return new Response(response.body,{status:response.status,headers});
}
