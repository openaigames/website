import { json } from './board-http.js';
const encoder=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const unb64=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
export const hash=value=>crypto.subtle.digest('SHA-256',encoder.encode(value)).then(b64);
function configured(env){return env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET&&env.ADMIN_SESSION_SECRET?.length>=32&&env.ADMIN_ORIGIN;}
export function adminOrigin(request,env){
 if(!configured(env)||!env.DB||env.CATALOG_MODE==='preview'||env.BOARD_UPSTREAM)return null;
 const url=new URL(env.ADMIN_ORIGIN);
 if(url.origin!==new URL(request.url).origin||url.pathname!=='/'||url.search||url.hash)return null;
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))return null;
 return url.origin;
}
function cookieName(request,kind){return (new URL(request.url).protocol==='https:'?'__Host-':'')+'oag_admin_'+kind;}
function cookie(request,kind,value,seconds){return `${cookieName(request,kind)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
function readCookie(request,kind){const name=cookieName(request,kind);return request.headers.get('Cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';}
const redirect=(url,cookies=[])=>{const headers=new Headers({'Location':url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});for(const c of cookies)headers.append('Set-Cookie',c);return new Response(null,{status:303,headers});};
async function encryptionKey(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(env.ADMIN_SESSION_SECRET)),'AES-GCM',false,['encrypt','decrypt']);}
export async function encryptToken(token,env){const iv=crypto.getRandomValues(new Uint8Array(12));return b64(iv)+'.'+b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(env),encoder.encode(token)));}
async function decryptToken(value,env){const [iv,data]=value.split('.');return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv)},await encryptionKey(env),unb64(data)));}
async function github(path,token){
 const response=await fetch('https://api.github.com'+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'OpenAIGames-Review','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(10000),redirect:'manual'});
 if([401,403,404].includes(response.status))return null;
 if(!response.ok)throw Error('GitHub is temporarily unavailable');
 return response.json();
}
export const isAdministrator = identity => identity.github_id === 102272920; // mattheliu; immutable GitHub user ID

export async function adminIdentity(request,env){
 if(!adminOrigin(request,env))return json({error:'管理员登录尚未配置。'},503);
 const token=readCookie(request,'session');if(!/^[\w-]{43}$/.test(token))return json({error:'请先使用 GitHub 登录。'},401);
 const session=await env.DB.prepare('SELECT * FROM admin_sessions WHERE hash=? AND expires_at>?').bind(await hash(token),Date.now()).first();
 if(!session)return json({error:'登录已过期，请重新登录。'},401);
 if(request.method!=='GET'||Date.now()-session.verified_at>300000){
  let access;try{access=await decryptToken(session.token,env);}catch{return json({error:'登录已过期，请重新登录。'},401);}
  const current=await github('/user',access);
  if(!current||current.id!==session.github_id){await env.DB.prepare('DELETE FROM admin_sessions WHERE hash=?').bind(session.hash).run();return json({error:'登录授权已失效，请重新登录。'},403);}
  await env.DB.prepare('UPDATE admin_sessions SET verified_at=? WHERE hash=?').bind(Date.now(),session.hash).run();
 }
 return session;
}
export async function login(request,env){
 const origin=adminOrigin(request,env);if(!origin)return json({error:'管理员登录尚未配置。'},503);
 const now=Date.now(),ipKey=await hash(`${Math.floor(now/86400000)}:${env.ADMIN_SESSION_SECRET}:${request.headers.get('CF-Connecting-IP')||'local'}`);
 const state=random(),verifier=random();
 const inserted=await env.DB.prepare('INSERT INTO admin_oauth_states(hash,verifier,ip_key,created_at,return_to) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM admin_oauth_states WHERE ip_key=? AND created_at>?)<10').bind(await hash(state),verifier,ipKey,now,new URL(request.url).searchParams.get('return')==='room'?'/':'/admin',ipKey,now-60000).run();
 if(!inserted.meta.changes)return json({error:'登录尝试过于频繁，请稍后重试。'},429,{'Retry-After':'60'});
 await env.DB.batch([env.DB.prepare('DELETE FROM admin_oauth_states WHERE created_at<?').bind(now-600000),env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at<?').bind(now)]);
 const url=new URL('https://github.com/login/oauth/authorize');url.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:origin+'/api/auth/github/callback',scope:'',state,code_challenge:await hash(verifier),code_challenge_method:'S256',allow_signup:'false'});
 return redirect(url.href,[cookie(request,'oauth',state,600)]);
}
export async function callback(request,env){
 const origin=adminOrigin(request,env);if(!origin)return json({error:'管理员登录尚未配置。'},503);
 const params=new URL(request.url).searchParams,state=params.get('state'),code=params.get('code');
 const failure=reason=>redirect('/admin?auth='+reason,[cookie(request,'oauth','',0)]);
 if(!state||!/^[\w-]{43}$/.test(state)||state!==readCookie(request,'oauth'))return failure('state');
 const pending=await env.DB.prepare('DELETE FROM admin_oauth_states WHERE hash=? AND created_at>? RETURNING verifier,return_to').bind(await hash(state),Date.now()-600000).first();
 if(!pending||!code||code.length>512)return failure('state');
 const response=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','User-Agent':'OpenAIGames-Review'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:origin+'/api/auth/github/callback',code_verifier:pending.verifier}),signal:AbortSignal.timeout(10000),redirect:'manual'});
 if(!response.ok)return failure('github');
 const result=await response.json();if(!result.access_token)return failure('github');
 const user=await github('/user',result.access_token);
 if(!user||!Number.isSafeInteger(user.id))return failure('denied');
 const now=Date.now(),seconds=Math.max(60,Math.min(28800,Number(result.expires_in)||28800)-60),token=random();
 await env.DB.prepare('INSERT INTO admin_sessions(hash,github_id,login,token,csrf,expires_at,verified_at) VALUES(?,?,?,?,?,?,?)').bind(await hash(token),user.id,user.login,await encryptToken(result.access_token,env),random(),now+seconds*1000,now).run();
 return redirect(pending.return_to==='/'?'/':'/admin',[cookie(request,'oauth','',0),cookie(request,'session',token,seconds)]);
}
export async function logout(request,env,session){await env.DB.prepare('DELETE FROM admin_sessions WHERE hash=?').bind(session.hash).run();return json({ok:true},200,{'Set-Cookie':cookie(request,'session','',0)});}
