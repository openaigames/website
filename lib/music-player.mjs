export class RoomMusicPlayer{
 constructor(audio,resolve,onchange=()=>{}){
  this.audio=audio;this.resolve=resolve;this.onchange=onchange;this.queue=[];this.index=0;this.wanted=false;this.suspended=false;this.loading=false;this.error='';this.generation=0;this.loaded=null;
  audio.addEventListener('ended',()=>{if(this.wanted&&!this.suspended)this.next(1);});
  audio.addEventListener('error',()=>{if(this.loaded){this.error='这首歌暂时无法播放，请换一首或在原平台收听。';this.wanted=false;this.loading=false;this.emit();}});
  for(const name of ['play','pause','timeupdate','loadedmetadata','durationchange'])audio.addEventListener(name,()=>this.emit());
 }
 get track(){return this.queue[this.index];}
 emit(){this.onchange(this);}
 setQueue(queue,index=0){this.pause();this.queue=queue;this.index=Math.max(0,Math.min(queue.length-1,index));this.unload();this.error='';this.emit();}
 unload(){this.generation++;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.loaded=null;}
 pause(){this.wanted=false;this.loading=false;this.generation++;this.audio.pause();this.emit();}
 async play(){
  if(!this.track)return;this.wanted=true;this.error='';
  if(this.suspended){this.emit();return;}
  const token=++this.generation,track=this.track;this.loading=true;this.emit();
  let timer;
  try{await Promise.race([(async()=>{
   if(this.loaded!==track){
    this.audio.pause();const src=await this.resolve(track);
    if(token!==this.generation||!this.wanted||this.suspended)return;
    this.audio.src=src;this.loaded=track;
   }
   await this.audio.play();
   if(token!==this.generation){if(!this.wanted||this.suspended)this.audio.pause();return;}
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('音乐载入超时，请换一首或稍后重试。')),18000);})]);
  }catch(error){if(token===this.generation){this.wanted=false;this.audio.pause();this.error=error.name==='NotAllowedError'?'请再点一次播放。':error.name==='NotSupportedError'?'这首歌暂时无法播放，请换一首或在原平台收听。':error.message||'这首歌暂时无法播放，请换一首或在原平台收听。';}}
  finally{clearTimeout(timer);if(token===this.generation){this.loading=false;this.emit();}}
 }
 toggle(){return this.wanted?this.pause():this.play();}
 async select(index,play=true){this.pause();this.index=Math.max(0,Math.min(this.queue.length-1,index));this.unload();this.error='';this.emit();if(play)return this.play();}
 next(direction=1){if(!this.queue.length)return;return this.select((this.index+direction+this.queue.length)%this.queue.length,this.wanted);}
 setSuspended(value){
  if(value===this.suspended)return;this.suspended=value;this.generation++;this.loading=false;
  if(value)this.audio.pause();else if(this.wanted)this.play();this.emit();
 }
}
