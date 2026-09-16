import {platformPlaylist,normalizePlatformPlaylist} from '../lib/music-playlist.mjs';
import {json} from './board-http.js';
const headers={'Accept':'application/json','User-Agent':'OpenAIGames/1.0'};
async function upstream(url,options={}){
 const response=await fetch(url,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(12000),redirect:'manual'});
 if(!response.ok)throw new Error('音乐平台暂时无法连接，请稍后重试。');
 const text=await response.text();if(text.length>4_000_000)throw new Error('歌单文件过大。');
 try{return JSON.parse(text);}catch{throw new Error('音乐平台暂时无法连接，请稍后重试。');}
}
export async function music(request){
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 const url=new URL(request.url);
 try{
  if(url.pathname==='/api/music/playlist'){
   const input=url.searchParams.get('url')||'';
   const platform=input.length<4096&&platformPlaylist(input);
   if(!platform)return json({error:'请粘贴网易云或 QQ 音乐的完整公开歌单链接。'},400);
   const data=platform.provider==='netease'
    ?await upstream(`https://music.163.com/api/playlist/detail?id=${platform.id}`)
    :await upstream(`https://c.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&disstid=${platform.id}&format=json`,{headers:{Referer:'https://y.qq.com/'}});
   return json(normalizePlatformPlaylist(platform,data));
  }
  if(url.pathname==='/api/music/stream'){
   const provider=url.searchParams.get('provider'),id=url.searchParams.get('id')||'';
   if(provider==='netease'&&/^\d{1,20}$/.test(id)){
    const response=await fetch(`https://music.163.com/song/media/outer/url?id=${id}.mp3`,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(12000)});
    const location=response.headers.get('location');
    if(!location)return json({error:'这首歌不支持站外播放，可在原平台收听或换一首。'},422);
    const stream=new URL(location,'https://music.163.com/');
    if(!stream.hostname.endsWith('.music.126.net')||!['http:','https:'].includes(stream.protocol))return json({error:'这首歌不支持站外播放，可在原平台收听或换一首。'},422);
    stream.protocol='https:';return json({url:stream.href});
   }
   if(provider!=='qq'||!/^[a-zA-Z0-9]{1,32}$/.test(id))return json({error:'歌曲信息不正确。'},400);
   const data=await upstream('https://u.y.qq.com/cgi-bin/musicu.fcg',{method:'POST',headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/'},body:JSON.stringify({comm:{uin:0,format:'json',ct:24,cv:0},req_0:{module:'vkey.GetVkeyServer',method:'CgiGetVkey',param:{guid:'1000000000',songmid:[id],songtype:[0],uin:'0',loginflag:0,platform:'20'}}})});
   const result=data.req_0?.data,path=result?.midurlinfo?.[0]?.purl;
   if(!path)return json({error:'这首歌不支持站外播放，可在原平台收听或换一首。'},422);
   const stream=new URL(path,result.sip?.[0]||'https://aqqmusic.tc.qq.com/');
   if(!stream.hostname.endsWith('.qq.com')||!['http:','https:'].includes(stream.protocol))throw new Error('歌曲音源暂不可用。');
   stream.protocol='https:';return json({url:stream.href});
  }
  return json({error:'找不到这个入口。'},404);
 }catch(error){return json({error:error.message||'音乐平台暂时无法连接，请稍后重试。'},502);}
}
