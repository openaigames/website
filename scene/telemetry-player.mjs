// Only explicit messages from the current iframe can confirm a playable game.
export function bindGameTelemetry(frame,game,{window:win=window,document:doc=document,clock=()=>performance.now()}={}){
 const telemetry=win.OpenAIGamesTelemetry;if(!frame||!telemetry)return ()=>{};
 const origin=new URL(frame.src,win.location.href).origin,nonce=crypto.randomUUID(),flow=telemetry.begin('game',{game});
 let disposed=false,ready=false,started=false,playing=false,total=0,lastReported=0,last=clock(),pending=0,lastStart=-Infinity;
 const post=()=>{if(!disposed)frame.contentWindow?.postMessage({type:'oag:telemetry:init',version:1,nonce},origin);};
 const visible=()=>doc.visibilityState==='visible'&&doc.hasFocus()&&!doc.body.classList.contains('site-open')&&!doc.querySelector('#dialog[open]');
 const sample=()=>{const time=clock(),gap=time-last;last=time;pending=playing&&visible()&&gap>=0&&gap<=10000?Math.min(10000,pending+gap):0;};
 const flush=()=>{if(total>lastReported){lastReported=total;telemetry.step(flow,'active',{durationMs:Math.round(total)});}};
 const message=event=>{
  if(disposed||event.source!==frame.contentWindow||event.origin!==origin||!event.data||event.data.version!==1)return;
  const data=event.data;
  if(data.type==='oag:telemetry:hello'){post();return;}
  if(data.type!=='oag:telemetry:event'||data.nonce!==nonce)return;
  if(data.event==='ready'&&!ready){ready=true;telemetry.step(flow,'ready',{durationMs:Math.round(clock()-startedAt)});}
  else if(data.event==='start'&&ready&&clock()-lastStart>=500){started=playing=true;pending=0;last=lastStart=clock();telemetry.step({...flow,attempt:crypto.randomUUID()},'start');}
  else if(data.event==='resume'&&ready&&started){playing=true;pending=0;last=clock();}
  else if(data.event==='pause'){sample();playing=false;pending=0;flush();}
  else if(data.event==='active'&&ready&&playing&&Number.isSafeInteger(data.deltaMs)&&data.deltaMs>=0&&data.deltaMs<=10000){sample();if(visible()){const accepted=Math.min(data.deltaMs,pending);pending-=accepted;total=Math.min(86400000,total+accepted);} }
  else if(data.event==='error'){telemetry.step(flow,'error',{code:'resource'});}
 };
 const startedAt=clock();
 win.addEventListener('message',message);frame.addEventListener('load',post);
 const sampleTimer=setInterval(sample,1000),saveTimer=setInterval(flush,15000),timeout=setTimeout(()=>{if(!ready)telemetry.step(flow,'timeout',{code:'timeout'});},30000);
 const hidden=()=>{sample();flush();pending=0;};doc.addEventListener('visibilitychange',hidden);win.addEventListener('blur',hidden);
 const dispose=()=>{if(disposed)return;sample();flush();telemetry.step(flow,'exit');disposed=true;clearInterval(sampleTimer);clearInterval(saveTimer);clearTimeout(timeout);win.removeEventListener('message',message);frame.removeEventListener('load',post);doc.removeEventListener('visibilitychange',hidden);win.removeEventListener('blur',hidden);win.removeEventListener('pagehide',dispose);};
 win.addEventListener('pagehide',dispose);post();return dispose;
}
