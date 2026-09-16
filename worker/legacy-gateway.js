const enc=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const digest=s=>crypto.subtle.digest('SHA-256',enc.encode(s)).then(hex);
const key=s=>crypto.subtle.importKey('raw',enc.encode(s),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const signingData=(stamp,client)=>enc.encode(`POST\n/api/board\n${stamp}\n${client}`);
const error=(message,status=503)=>Response.json({error:message},{status,headers:{'Cache-Control':'no-store',...(status===503?{'Retry-After':'60'}:{})}});
async function clientKey(request,env,now){
 const client=request.headers.get('X-Board-Client'),stamp=request.headers.get('X-Board-Time'),signature=request.headers.get('X-Board-Signature');
 if(!client&&!stamp&&!signature)return digest(`${Math.floor(now/86400000)}:openaigames-board:${request.headers.get('CF-Connecting-IP')||'local'}`);
 if(!env.BOARD_RELAY_SECRET||!/^[a-f0-9]{64}$/.test(client||'')||!/^\d{13}$/.test(stamp||'')||!/^[a-f0-9]{64}$/.test(signature||'')||Math.abs(now-Number(stamp))>120000)return null;
 return await crypto.subtle.verify('HMAC',await key(env.BOARD_RELAY_SECRET),Uint8Array.from(signature.match(/../g),x=>parseInt(x,16)),signingData(stamp,client))?client:null;
}
export default {
 async fetch(request,env){
  const source=new URL(request.url),upstream=new URL(env.UPSTREAM);
  if(upstream.protocol!=='https:'||upstream.origin===source.origin)return error('网站暂时无法连接。');
  // Identity belongs to the primary origin; never proxy a login cookie across hosts.
  if(env.GATEWAY_MODE!=='preview'&&(['/admin','/admin/'].includes(source.pathname)||source.pathname==='/api/auth/github/login')){
   if(request.method!=='GET'&&request.method!=='HEAD')return error('请在主站登录后操作。',403);
   return new Response(null,{status:303,headers:{Location:new URL(source.pathname+source.search,'https://openaigames.org').href,'Cache-Control':'no-store'}});
  }
  if(source.pathname.startsWith('/api/auth/')||source.pathname.startsWith('/api/admin/'))return error('请在 openaigames.org 登录。',401);
  const target=new URL(source.pathname+source.search,upstream),headers=new Headers(request.headers);
  headers.delete('Host');headers.delete('Cookie');headers.delete('Authorization');
  for(const name of ['X-Board-Client','X-Board-Time','X-Board-Signature'])headers.delete(name);
  const write=!['GET','HEAD'].includes(request.method);
  if(write&&env.MIGRATION_READ_ONLY==='1')return error('网站正在迁移，请稍后重试。');
  if(source.pathname==='/internal/catalog'&&write){
   if(env.GATEWAY_MODE!=='preview'||!env.CATALOG_PUBLISH_SECRET||!env.UPSTREAM_PUBLISH_SECRET||await digest(request.headers.get('Authorization')||'')!==await digest('Bearer '+env.CATALOG_PUBLISH_SECRET))return error('Unauthorized',403);
   headers.set('Authorization','Bearer '+env.UPSTREAM_PUBLISH_SECRET);
  }else if(write){
   if(env.GATEWAY_MODE==='preview'||request.method!=='POST'||!['/api/board','/api/submissions'].includes(source.pathname))return error('不支持这个操作。',405);
   if(request.headers.get('Origin')!==source.origin)return error('请在本站打开表单。',403);
   if(!request.headers.get('Content-Type')?.startsWith('application/json'))return error('请使用表单提交。',415);
   if(Number(request.headers.get('Content-Length'))>8192)return error('内容太长了。',413);
   const stamp=String(Date.now()),client=await clientKey(request,env,Number(stamp));
   if(!client||!env.UPSTREAM_RELAY_SECRET)return error('连接校验失败，请刷新重试。',403);
   headers.set('X-Board-Client',client);headers.set('X-Board-Time',stamp);
   headers.set('X-Board-Signature',hex(await crypto.subtle.sign('HMAC',await key(env.UPSTREAM_RELAY_SECRET),signingData(stamp,client))));
  }
  if(headers.get('Origin')===source.origin)headers.set('Origin',upstream.origin);
  try{
   const response=await fetch(target,{method:request.method,headers,body:write?request.body:undefined,redirect:'manual',signal:AbortSignal.timeout(25000),duplex:'half'});
   const out=new Headers(response.headers),location=out.get('Location');
   if(location){const url=new URL(location,target);if(url.origin===upstream.origin)out.set('Location',source.origin+url.pathname+url.search+url.hash);}
   out.set('X-OpenAIGames-Data-Origin','openaigames.org');
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers:out});
  }catch{return error('网站暂时连接不上，请稍后重试。');}
 }
};
