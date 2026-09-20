/* Optional OpenAIGames game bridge, v1. Call ready() only once the game really works.
   No cookies, network collector or game inputs are transmitted by this SDK. */
(() => {
 if(window.parent===window)return;
 const allowed=['https://openaigames.org','https://openaigames.lens-frontier.workers.dev','https://openaigames.3325932294.workers.dev'];
 let parentOrigin;try{parentOrigin=new URL(document.referrer).origin;}catch{return;}
 if(!allowed.includes(parentOrigin)&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(parentOrigin))return;
 let nonce='',ready=false,playing=false,last=performance.now(),activity=last;
 const send=(event,extra={})=>{if(nonce)parent.postMessage({type:'oag:telemetry:event',version:1,nonce,event,...extra},parentOrigin);};
 window.addEventListener('message',event=>{
  if(event.source!==parent||event.origin!==parentOrigin||event.data?.type!=='oag:telemetry:init'||event.data.version!==1||!/^[-a-f0-9]{36}$/.test(event.data.nonce||''))return;
  if(nonce===event.data.nonce)return;nonce=event.data.nonce;if(ready)send('ready');if(playing)send('start');
 });
 const touch=()=>{activity=performance.now();};
 for(const event of ['pointerdown','pointermove','keydown','touchstart'])document.addEventListener(event,touch,{passive:true,capture:true});
 setInterval(()=>{const now=performance.now(),gap=now-last;last=now;if(ready&&playing&&document.visibilityState==='visible'&&document.hasFocus()&&gap>=0&&gap<=10000){const deltaMs=Math.max(0,Math.floor(Math.min(now,activity+60000)-(now-gap)));if(deltaMs)send('active',{deltaMs});}},5000);
 window.OpenAIGamesGame=Object.freeze({ready(){if(!ready){ready=true;send('ready');}},start(){if(!ready)return;playing=true;last=activity=performance.now();send('start');},pause(){playing=false;send('pause');},resume(){playing=true;last=activity=performance.now();send('resume');},error(){send('error');}});
 parent.postMessage({type:'oag:telemetry:hello',version:1},parentOrigin);
})();
