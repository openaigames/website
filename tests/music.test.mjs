import {test} from 'node:test';
import assert from 'node:assert/strict';
import {platformPlaylist,parsePlaylist,normalizePlatformPlaylist} from '../lib/music-playlist.mjs';
import {RoomMusicPlayer} from '../lib/music-player.mjs';
import {music} from '../worker/music.js';
import {panRoomPose} from '../scene/room-pan.mjs';
import {ROOM,CAMERA_CLEARANCE} from '../scene/camera-motion.mjs';
import {Vector3} from 'three';

test('playlist links accept public platform forms and reject lookalike hosts',()=>{
 assert.equal(platformPlaylist('分享歌单 https://music.163.com/#/playlist?id=6780656972').id,'6780656972');
 assert.equal(platformPlaylist('https://y.qq.com/n/ryqq/playlist/9209322004').provider,'qq');
 assert.equal(platformPlaylist('https://i.y.qq.com/n2/m/share/details/taoge.html?id=123').id,'123');
 for(const url of ['https://music.163.com.evil.test/playlist?id=1','http://music.163.com/playlist?id=1','https://user:pass@music.163.com/playlist?id=1','https://music.163.com/playlist?id=1%26x','https://127.0.0.1/playlist?id=1'])assert.equal(platformPlaylist(url),null);
});
test('JSON and M3U imports resolve local audio and preserve names',()=>{
 const file={id:'a',fileId:'a',title:'Local'};
 const p=parsePlaylist('#EXTM3U\n#EXTINF:45,My song\n./piano.wav\n#EXTINF:12,Remote\nhttps://audio.example/track.mp3','Test.m3u',new Map([['piano.wav',file]]));
 assert.equal(p.name,'Test');assert.equal(p.tracks[0].fileId,'a');assert.equal(p.tracks[0].title,'My song');assert.equal(p.tracks[1].url,'https://audio.example/track.mp3');
 assert.equal(parsePlaylist('{"name":"Mix","tracks":[{"url":"https://audio.example/a.mp3","title":"Hello"}]}').name,'Mix');
 assert.throws(()=>parsePlaylist('#EXTM3U\n#EXT-X-TARGETDURATION:10\na.ts','a.m3u8'),/分段/);
 assert.throws(()=>parsePlaylist(JSON.stringify({tracks:Array(301).fill('https://audio.example/a.mp3')})),/300/);
 assert.throws(()=>parsePlaylist('{"tracks":["file:///etc/passwd"]}'),/HTTPS/);
 assert.throws(()=>parsePlaylist('{"tracks":["http://localhost/a.mp3"]}'),/HTTPS/);
});
test('platform metadata handles NetEase and both QQ song formats',()=>{
 const n=normalizePlatformPlaylist({provider:'netease',url:'https://music.163.com/playlist?id=1'},{result:{name:'Mix',trackCount:9,tracks:[{id:1,name:'Piano',artists:[{name:'Artist'}]}]}});
 assert.equal(n.tracks[0].artist,'Artist');assert.equal(n.total,9);
 const q=normalizePlatformPlaylist({provider:'qq',url:'https://y.qq.com/n/ryqq/playlist/1'},{cdlist:[{dissname:'Mix',songlist:[{songmid:'ABC',songname:'One',singer:[{name:'A'}]},{mid:'DEF',name:'Two',singer:[{name:'B'}]}]}]});
 assert.deepEqual(q.tracks.map(x=>x.sourceId),['ABC','DEF']);
});
class FakeAudio extends EventTarget{
 paused=true;src='';currentTime=0;
 async play(){this.paused=false;this.dispatchEvent(new Event('play'));}
 pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
 removeAttribute(){this.src='';}load(){this.currentTime=0;}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('switching or pausing cancels late audio resolution and stops old audio immediately',async()=>{
 const audio=new FakeAudio(),resolvers=new Map();const player=new RoomMusicPlayer(audio,track=>new Promise(resolve=>resolvers.set(track.id,resolve)));
 player.setQueue([{id:'a'},{id:'b'}]);const first=player.play();const second=player.select(1);
 assert.equal(audio.paused,true);resolvers.get('b')('b.mp3');await second;resolvers.get('a')('a.mp3');await first;
 assert.equal(audio.src,'b.mp3');assert.equal(audio.paused,false);
 const pending=player.select(0);player.pause();resolvers.get('a')('a.mp3');await pending;
 assert.equal(audio.paused,true);assert.notEqual(audio.src,'a.mp3');
});
test('gameplay suspension resumes only when music was wanted and ended advances the queue',async()=>{
 const audio=new FakeAudio(),player=new RoomMusicPlayer(audio,async track=>track.id+'.wav');player.setQueue([{id:'a'},{id:'b'}]);await player.play();
 player.setSuspended(true);assert.equal(audio.paused,true);assert.equal(player.wanted,true);
 player.setSuspended(false);await tick();assert.equal(audio.paused,false);
 audio.dispatchEvent(new Event('ended'));await tick();assert.equal(player.index,1);assert.equal(audio.src,'b.wav');
 player.setSuspended(true);player.pause();player.setSuspended(false);await tick();assert.equal(audio.paused,true);
});
test('platform errors do not leave a false playing state',async()=>{
 const audio=new FakeAudio(),player=new RoomMusicPlayer(audio,async()=>{throw new Error('Unavailable');});player.setQueue([{id:'a'}]);await player.play();
 assert.equal(player.wanted,false);assert.equal(player.loading,false);assert.equal(player.error,'Unavailable');
});
test('music endpoints constrain upstream requests and report platform playback restrictions',async t=>{
 const calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return Response.json({req_0:{data:{midurlinfo:[{purl:''}]}}});});
 const invalid=await music(new Request('https://room.test/api/music/playlist?url='+encodeURIComponent('https://evil.test/playlist?id=1')));assert.equal(invalid.status,400);assert.equal(calls.length,0);
 const netease=await music(new Request('https://room.test/api/music/stream?provider=netease&id=123'));assert.equal(netease.status,422);assert.equal(calls.length,1);
 const qq=await music(new Request('https://room.test/api/music/stream?provider=qq&id=ABC'));assert.equal(qq.status,422);assert.equal(calls[1].url,'https://u.y.qq.com/cgi-bin/musicu.fcg');assert.equal(calls[1].options.redirect,'manual');
});
test('panning keeps camera direction and distance and never crosses a wall',()=>{
 let position=new Vector3(4,8,18),target=new Vector3(2,1,0);const offset=position.clone().sub(target);
 for(const [dx,dy] of [[100,80],[-9000,0],[0,9000],[9000,-9000],[-1000,4000]]){
  const p=panRoomPose(position,target,dx,dy,800,45);assert.ok(p.position.clone().sub(p.target).distanceTo(offset)<1e-9);
  for(const v of [p.position,p.target])for(const [axis,low,high] of [['x',ROOM.left,ROOM.right],['y',ROOM.floor,ROOM.ceiling],['z',ROOM.back,ROOM.front]]){assert.ok(v[axis]>=low+CAMERA_CLEARANCE-1e-9);assert.ok(v[axis]<=high-CAMERA_CLEARANCE+1e-9);}
  position=p.position;target=p.target;
 }
});

test('NetEase stream resolution accepts only the platform audio CDN and upgrades HTTPS',async t=>{
 let location='http://m801.music.126.net/audio/test.mp3';t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:302,headers:{location}}));
 const request=()=>new Request('https://room.test/api/music/stream?provider=netease&id=123');
 assert.equal((await (await music(request())).json()).url,'https://m801.music.126.net/audio/test.mp3');
 location='https://music.126.net.evil.test/audio.mp3';assert.equal((await music(request())).status,422);
 location='http://music.163.com/404';assert.equal((await music(request())).status,422);
});
