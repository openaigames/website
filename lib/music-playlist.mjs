export const MAX_TRACKS=300;
export function platformPlaylist(input){
 const match=String(input).match(/https:\/\/[^\s<>"，。]+/i);if(!match)return null;
 let url;try{url=new URL(match[0]);}catch{return null;}
 if(url.username||url.password||url.port)return null;
 if(url.hostname==='music.163.com'){
  const route=url.hash.startsWith('#/')?new URL(url.hash.slice(1),url.origin):url;
  const id=route.searchParams.get('id');
  if(/\/playlist\/?$/.test(route.pathname)&&/^\d{1,20}$/.test(id||''))return {provider:'netease',id,url:`https://music.163.com/playlist?id=${id}`};
 }
 if(['y.qq.com','i.y.qq.com'].includes(url.hostname)){
  const id=url.pathname.match(/\/playlist\/(\d+)(?:\.html)?\/?$/)?.[1]||url.searchParams.get('disstid')||(/(?:taoge|playlist)/.test(url.pathname)?url.searchParams.get('id'):null);
  if(/^\d{1,20}$/.test(id||''))return {provider:'qq',id,url:`https://y.qq.com/n/ryqq/playlist/${id}`};
 }
 return null;
}
export function audioUrl(input){
 try{const u=new URL(input);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function parsePlaylist(text,filename='playlist.json',files=new Map()){
 if(text.length>2_000_000)throw new Error('歌单文件过大。');
 const clean=text.replace(/^\uFEFF/,'');let name=filename.replace(/\.[^.]+$/,''),entries=[];
 if(/\.json$/i.test(filename)||/^[\s]*[\[{]/.test(clean)){
  let data;try{data=JSON.parse(clean);}catch{throw new Error('歌单 JSON 格式不正确。');}
  name=String(data.title||data.name||name).slice(0,120);entries=Array.isArray(data)?data:data.tracks;
  if(!Array.isArray(entries))throw new Error('歌单需要包含 tracks 列表。');
 }else{
  if(/#EXT-X-/i.test(clean))throw new Error('这是分段音频清单，请添加完整音频直链。');
  let title='';for(const line of clean.split(/\r?\n/).map(s=>s.trim())){
   if(line.startsWith('#EXTINF:'))title=line.slice(line.indexOf(',')+1);
   else if(line&&!line.startsWith('#')){entries.push({url:line,title});title='';}
  }
 }
 if(!entries.length)throw new Error('歌单里没有找到歌曲。');
 if(entries.length>MAX_TRACKS)throw new Error('每次最多导入 300 首歌曲。');
 const tracks=entries.map((item,i)=>{
  if(typeof item==='string')item={url:item};
  if(!item||typeof item!=='object')throw new Error('歌单歌曲格式不正确。');
  const raw=String(item.url||item.src||''),file=files.get(raw)||files.get(raw.replace(/^\.\//,''));
  if(file)return {...file,title:String(item.title||item.name||file.title).slice(0,180)};
  const url=audioUrl(raw);if(!url)throw new Error('请使用 HTTPS 音频直链，或同时选择歌单引用的音频文件。');
  return {id:`url-${i}`,title:String(item.title||item.name||decodeURIComponent(new URL(url).pathname.split('/').pop())||'Audio').slice(0,180),artist:String(item.artist||'').slice(0,160),url};
 });
 return {name,tracks};
}

export function normalizePlatformPlaylist(platform,data){
 const source=platform.provider==='netease'?(data.playlist||data.result):data.cdlist?.[0];
 if(!source)throw new Error('歌单未公开、已失效或暂时无法读取。');
 const songs=source.tracks||source.songlist||[];
 const tracks=songs.slice(0,MAX_TRACKS).map(song=>{
  const netease=platform.provider==='netease',id=String(netease?song.id:song.mid||song.songmid||'');
  if(!(netease?/^\d{1,20}$/:/^[a-zA-Z0-9]{1,32}$/).test(id))return null;
  return {id:`${platform.provider}-${id}`,provider:platform.provider,sourceId:id,title:String(song.name||song.songname||'Audio').slice(0,180),artist:(song.ar||song.artists||song.singer||[]).map(a=>a.name).join(' / ').slice(0,160),sourceUrl:netease?`https://music.163.com/song?id=${id}`:`https://y.qq.com/n/ryqq/songDetail/${id}`};
 }).filter(Boolean);
 if(!tracks.length)throw new Error('歌单里没有可读取的公开歌曲。');
 return {name:String(source.name||source.dissname||'Playlist').slice(0,160),tracks,total:Number(source.trackCount||source.total_song_num||tracks.length),sourceUrl:platform.url};
}
