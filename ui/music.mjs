import {RoomMusicPlayer} from '../lib/music-player.mjs';
import {parsePlaylist,platformPlaylist,audioUrl,MAX_TRACKS} from '../lib/music-playlist.mjs';
import {saveAudio,readAudio,deleteAudio} from '../lib/music-storage.mjs';

const t=text=>window.OpenAIGamesI18n?.t(text)||text;
const esc=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const builtIn={id:'room-originals',name:'房间原声',tracks:[
 {id:'moonlit-room',title:'月下漫游',artist:'氛围钢琴 · 原创合成',url:'/static/music/moonlit-room.wav'},
 {id:'blue-hour',title:'蓝色时刻',artist:'轻柔纯音乐 · 原创合成',url:'/static/music/blue-hour.wav'},
 {id:'little-serenade',title:'小夜曲',artist:'古典风钢琴 · 原创合成',url:'/static/music/little-serenade.wav'}
]};
const key='openaigames-music-v1';let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
let lists=[builtIn,...(Array.isArray(saved.lists)?saved.lists:[]).filter(list=>list&&Array.isArray(list.tracks)&&list.id!==builtIn.id).slice(0,30)];
let selected=lists.find(list=>list.id===saved.selected)||builtIn,renderedQueue='',lastStatus='',open=false;
const objectUrls=new Map(),sessionFiles=new Map();
const audio=new Audio();audio.preload='metadata';audio.volume=Number.isFinite(saved.volume)?Math.max(0,Math.min(1,saved.volume)):.35;
async function resolve(track){
 if(track.fileId){
  if(objectUrls.has(track.fileId))return objectUrls.get(track.fileId);
  const blob=sessionFiles.get(track.fileId)||await readAudio(track.fileId);
  if(!blob)throw new Error('本地音频已被浏览器清理，请重新导入。');
  const url=URL.createObjectURL(blob);objectUrls.set(track.fileId,url);return url;
 }
 if(track.provider){
  const response=await fetch(`/api/music/stream?provider=${encodeURIComponent(track.provider)}&id=${encodeURIComponent(track.sourceId)}`);
  const data=await response.json();if(!response.ok||!audioUrl(data.url))throw new Error(data.error||'歌曲音源暂不可用。');return data.url;
 }
 if(track.url?.startsWith('/static/music/')&&builtIn.tracks.includes(track))return track.url;
 const url=audioUrl(track.url);if(!url)throw new Error('歌曲音源暂不可用。');return url;
}
const music=document.createElement('aside');music.className='room-music';music.setAttribute('aria-label','房间音乐');
music.innerHTML=`<button class="music-launcher" type="button" aria-label="打开音乐播放器" aria-expanded="false" aria-controls="room-music-panel"><span class="music-note" aria-hidden="true">♫</span><span>音乐</span><i aria-hidden="true"></i></button>
<section id="room-music-panel" class="music-panel" aria-label="音乐播放器" hidden>
 <header><div><small>OpenAIGames / RADIO</small><h2>房间音乐</h2></div><button type="button" data-music="close" aria-label="关闭音乐面板">×</button></header>
 <div class="music-cassette" aria-hidden="true"><span class="music-reel"></span><span class="music-tape">SIDE A<br>PLAY SOMETHING GOOD</span><span class="music-reel"></span></div>
 <div class="music-now"><strong data-now-title data-i18n-ignore></strong><span data-now-artist data-i18n-ignore></span></div>
 <div class="music-transport"><button type="button" data-music="previous" aria-label="上一首">⏮</button><button type="button" data-music="toggle" aria-label="播放音乐" aria-pressed="false">▶</button><button type="button" data-music="next" aria-label="下一首">⏭</button><label class="music-volume"><span>音量</span><input aria-label="音乐音量" type="range" min="0" max="1" step="0.05" value="${audio.volume}"></label></div>
 <div class="music-progress"><span data-time>0:00</span><input type="range" aria-label="播放进度" min="0" max="1" step="0.1" value="0"><span data-duration>0:00</span></div>
 <p class="music-status" role="status" data-i18n-ignore></p>
 <a class="music-source" hidden target="_blank" rel="noopener noreferrer">在原平台收听 ↗</a>
 <label class="music-list-label"><span>当前歌单</span><select aria-label="选择歌单"></select><button type="button" data-music="remove" aria-label="移除此歌单">×</button></label>
 <ol class="music-tracks" aria-label="歌曲列表"></ol>
 <details class="music-import"><summary>＋ 导入歌单</summary><p>支持网易云、QQ 音乐公开歌单链接和 HTTPS 音频直链。</p><form><label for="music-link">歌单或音频链接</label><div><input id="music-link" type="text" placeholder="粘贴歌单链接或音频直链" required maxlength="4096"><button type="submit">导入</button></div></form><label class="music-file">选择音频 / M3U / JSON 文件<input type="file" accept="audio/*,.m3u,.m3u8,.json" multiple></label><p>本地音频只保存在当前浏览器。平台歌曲能否播放以平台开放权限为准。</p><button type="button" data-music="example">下载歌单模板</button><p class="music-import-status" role="status" data-i18n-ignore></p></details>
</section>`;
const launcher=music.querySelector('.music-launcher');document.querySelector('.site-utilities').prepend(launcher);
audio.hidden=true;audio.id='room-music-audio';music.append(audio);document.body.append(music);
const $=selector=>music.querySelector(selector);
function persist(){
 try{localStorage.setItem(key,JSON.stringify({lists:lists.slice(1),selected:selected.id,index:player.index,volume:audio.volume}));return true;}
 catch{$('.music-import-status').textContent=t('浏览器未能保存歌单，本次仍可播放。');return false;}
}
function clock(value){if(!Number.isFinite(value)||value<0)return '0:00';return `${Math.floor(value/60)}:${String(Math.floor(value%60)).padStart(2,'0')}`;}
function renderLists(){
 const select=$('select');select.replaceChildren(...lists.map(list=>{const option=new Option(list.id===builtIn.id?t(list.name):list.name,list.id);option.selected=list.id===selected.id;return option;}));
 $('[data-music="remove"]').disabled=selected===builtIn;
}
function renderQueue(){
 const identity=selected.id+':'+(window.OpenAIGamesI18n?.locale||'zh');if(identity===renderedQueue)return;renderedQueue=identity;
 $('.music-tracks').innerHTML=selected.tracks.map((track,index)=>`<li><button type="button" data-track="${index}" aria-pressed="false"><span class="music-track-number">${String(index+1).padStart(2,'0')}</span><span data-i18n-ignore><strong>${esc(selected===builtIn?t(track.title):track.title)}</strong><small>${esc(track.fileId?t('本地音频'):selected===builtIn?t(track.artist):track.artist)}</small></span></button></li>`).join('');
}
function render(player){
 const track=player.track,active=player.wanted&&!player.suspended&&!audio.paused;
 music.dataset.playing=String(active);music.dataset.suspended=String(player.suspended);launcher.dataset.playing=String(active);launcher.hidden=player.suspended;
 const button=$('[data-music="toggle"]');button.textContent=player.wanted?'Ⅱ':'▶';button.setAttribute('aria-label',t(player.wanted?'暂停音乐':'播放音乐'));button.setAttribute('aria-pressed',String(player.wanted));
 $('[data-now-title]').textContent=track?(selected===builtIn?t(track.title):track.title):t('选择一首歌');
 $('[data-now-artist]').textContent=track?(track.fileId?t('本地音频'):selected===builtIn?t(track.artist):track.artist):'';
 const status=player.error?t(player.error):player.suspended?t('游戏中，背景音乐已暂停'):player.loading?t('正在载入音乐…'):player.wanted?t('正在播放'):t('点播放，让房间有点声音。');
 if(lastStatus!==status){$('.music-status').textContent=status;lastStatus=status;}
 const source=$('.music-source');source.hidden=!track?.sourceUrl;if(track?.sourceUrl)source.href=track.sourceUrl;
 const duration=Number.isFinite(audio.duration)?audio.duration:0,progress=$('.music-progress input');progress.disabled=!duration;progress.max=String(duration||1);if(document.activeElement!==progress)progress.value=String(audio.currentTime||0);
 $('[data-time]').textContent=clock(audio.currentTime);$('[data-duration]').textContent=clock(duration);
 for(const entry of music.querySelectorAll('[data-track]'))entry.setAttribute('aria-pressed',String(Number(entry.dataset.track)===player.index));
 window.dispatchEvent(new CustomEvent('openaigames-music',{detail:{playing:active}}));
}
const player=new RoomMusicPlayer(audio,resolve,render);player.setQueue(selected.tracks,selected.id===saved.selected?saved.index||0:0);renderLists();renderQueue();render(player);
function setOpen(next){open=next;document.body.classList.toggle('music-open',open);$('.music-panel').hidden=!open;launcher.setAttribute('aria-expanded',String(open));if(open)$('[data-music="close"]').focus();}
function setList(list){renderedQueue='';selected=list;player.setQueue(list.tracks);renderLists();renderQueue();render(player);persist();}
function addList(list){
 if(!list.tracks.length)throw new Error('歌单里没有找到歌曲。');
 if(lists.length>=31)throw new Error('最多保存 30 个自定义歌单。');
 const previous=list.sourceUrl&&lists.find(item=>item.sourceUrl===list.sourceUrl);
 list.id=previous?.id||crypto.randomUUID();if(previous)lists[lists.indexOf(previous)]=list;else lists.push(list);
 setList(list);$('.music-import-status').textContent=`${t('已导入')} ${list.tracks.length}${list.total>list.tracks.length?` / ${list.total}`:''} ${t('首歌曲')}`;
}
launcher.addEventListener('click',()=>setOpen(!open));
music.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.track!==undefined){await player.select(Number(button.dataset.track));persist();return;}
 switch(button.dataset.music){
  case 'close':setOpen(false);break;
  case 'toggle':await player.toggle();break;
  case 'previous':await player.next(-1);persist();break;
  case 'next':await player.next(1);persist();break;
  case 'remove':{
   if(selected===builtIn)break;const old=selected;lists=lists.filter(list=>list!==old);setList(builtIn);
   for(const track of old.tracks)if(track.fileId&&!lists.some(list=>list.tracks.some(item=>item.fileId===track.fileId))){const url=objectUrls.get(track.fileId);if(url)URL.revokeObjectURL(url);objectUrls.delete(track.fileId);sessionFiles.delete(track.fileId);deleteAudio(track.fileId).catch(()=>{});}break;
  }
  case 'example':{
   const url=URL.createObjectURL(new Blob([JSON.stringify({name:t('我的歌单'),tracks:[{title:t('月下漫游'),artist:'OpenAIGames',url:new URL(builtIn.tracks[0].url,location.origin).href}]},null,2)],{type:'application/json'}));
   const link=document.createElement('a');link.href=url;link.download='openaigames-playlist.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;
  }
 }
});
$('select').addEventListener('change',event=>{const list=lists.find(list=>list.id===event.target.value);if(list)setList(list);});
$('.music-volume input').addEventListener('input',event=>{audio.volume=Number(event.target.value);persist();});
$('.music-progress input').addEventListener('input',event=>{if(Number.isFinite(audio.duration))audio.currentTime=Number(event.target.value);});
let importing=false;
async function importTask(work){
 if(importing)return;importing=true;const controls=[...music.querySelectorAll('.music-import input,.music-import button')];controls.forEach(input=>input.disabled=true);$('.music-import-status').textContent=t('正在导入…');
 try{await work();}catch(error){$('.music-import-status').textContent=t(error.name==='TypeError'||error.name==='TimeoutError'?'导入失败，请检查链接或文件。':error.message||'导入失败，请检查链接或文件。');}
 finally{importing=false;controls.forEach(input=>input.disabled=false);}
}
$('form').addEventListener('submit',event=>{event.preventDefault();const input=$('#music-link').value.trim();importTask(async()=>{
 const platform=platformPlaylist(input);
 if(platform){const response=await fetch('/api/music/playlist?url='+encodeURIComponent(platform.url),{signal:AbortSignal.timeout(18000)});const data=await response.json();if(!response.ok)throw new Error(data.error);addList(data);}
 else{
  const url=audioUrl(input);if(!url)throw new Error('请粘贴完整歌单链接或 HTTPS 音频直链。');
  if(/(?:163\.com|qq\.com)/.test(new URL(url).hostname))throw new Error('请粘贴网易云或 QQ 音乐的完整公开歌单链接。');
  if(/\.(?:m3u8?|json)(?:$|\?)/i.test(url)){
   const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('歌单链接无法读取，也可以下载文件后导入。');
   addList(parsePlaylist(await response.text(),new URL(url).pathname.split('/').pop()));
  }else if(/\.(?:mp3|m4a|aac|ogg|opus|wav|flac|webm)(?:$|\?)/i.test(url))addList({name:t('音频直链'),tracks:[{id:crypto.randomUUID(),title:decodeURIComponent(new URL(url).pathname.split('/').pop()),artist:'',url}]});
  else throw new Error('请使用音频直链；普通网页链接无法作为音频播放。');
 }
 $('#music-link').value='';
 });});
$('.music-file input').addEventListener('change',event=>{const files=[...event.target.files];event.target.value='';if(!files.length)return;importTask(async()=>{
 if(files.length>MAX_TRACKS)throw new Error('每次最多导入 300 首歌曲。');
 if(files.reduce((n,file)=>n+file.size,0)>500_000_000)throw new Error('本次文件超过 500 MB，请分批导入。');
 const audioFiles=files.filter(file=>file.type.startsWith('audio/')&&!/\.m3u8?$/i.test(file.name)||/\.(mp3|m4a|wav|ogg|opus|flac|aac|webm)$/i.test(file.name));
 const fileMap=new Map(),pending=[];
 for(const file of audioFiles){const id=crypto.randomUUID();fileMap.set(file.name,{id,fileId:id,title:file.name.replace(/\.[^.]+$/,''),artist:t('本地音频')});pending.push({id,file});}
 const playlistFiles=files.filter(file=>/\.(m3u8?|json)$/i.test(file.name));
 const parsed=[];for(const file of playlistFiles)parsed.push(parsePlaylist(await file.text(),file.name,fileMap));
 if(!playlistFiles.length&&fileMap.size)parsed.push({name:t('我的本地音乐'),tracks:[...fileMap.values()]});
 if(!parsed.length)throw new Error('请选择音频、M3U 或 JSON 歌单文件。');
 if(lists.length+parsed.length>31)throw new Error('最多保存 30 个自定义歌单。');
 const referenced=new Set(parsed.flatMap(list=>list.tracks.map(track=>track.fileId)));let persisted=true;for(const {id,file} of pending){if(!referenced.has(id))continue;sessionFiles.set(id,file);try{await saveAudio(id,file);}catch{persisted=false;}}
 for(const list of parsed)addList(list);
 if(!persisted)$('.music-import-status').textContent=t('音频已导入，本次可播放；浏览器空间不足，刷新后可能需要重新选择文件。');
 });});
music.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);launcher.focus();}});
window.addEventListener('openaigames-language',()=>{renderLists();renderQueue();render(player);});
function gameState(){player.setSuspended(window.OpenAIGamesHost?.state().route==='game');}
window.addEventListener('openaigames-state',gameState);window.addEventListener('hashchange',()=>{if(/^#\/game\//.test(location.hash))player.setSuspended(true);else gameState();});gameState();
window.addEventListener('pagehide',()=>{player.pause();persist();});
window.OpenAIGamesMusic=Object.freeze({open:()=>setOpen(true),close:()=>{setOpen(false);launcher.focus({preventScroll:true});}});
