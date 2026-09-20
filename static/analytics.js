(() => {
 if(new URLSearchParams(location.search).get('analytics')==='off'||window.top!==window.self||navigator.doNotTrack==='1'||navigator.globalPrivacyControl||location.hostname.startsWith('preview.')||location.hostname.includes('-preview.')||location.pathname!=='/')return;
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const key='openaigames-analytics-visitor';let visitor;
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&UUID.test(saved.id)&&saved.expires>Date.now())visitor=saved.id;else{visitor=crypto.randomUUID();localStorage.setItem(key,JSON.stringify({id:visitor,expires:Date.now()+90*86400000}));}}catch{visitor=crypto.randomUUID();}
 const aliases={wechat:'wechat',weixin:'wechat',pengyouquan:'wechat',xiaohongshu:'xiaohongshu',xhs:'xiaohongshu',github:'github',x:'x',twitter:'x',bilibili:'bilibili',search:'search'};
 const source=()=>{const tag=new URLSearchParams(location.search).get('utm_source');if(tag)return aliases[tag.toLowerCase()]||'other';try{const host=new URL(document.referrer).hostname;if(host===location.hostname||['openaigames.org','openaigames.lens-frontier.workers.dev'].includes(host))return 'direct';if(host==='github.com'||host.endsWith('.github.com'))return 'github';if(host==='x.com'||host==='t.co'||host.endsWith('.twitter.com'))return 'x';if(host.endsWith('xiaohongshu.com'))return 'xiaohongshu';if(host.endsWith('weixin.qq.com'))return 'wechat';if(host.endsWith('bilibili.com'))return 'bilibili';if(/(^|\.)(google\.[a-z.]+|bing\.com|baidu\.com|duckduckgo\.com)$/.test(host))return 'search';return 'other';}catch{return 'direct';}};
 const channel=source(),device=matchMedia('(pointer:coarse)').matches?'mobile':'desktop';
 // The legacy hostname has a read/write proxy with an intentionally narrow route list.
 // Anonymous metrics go straight to the same primary endpoint; no cookies are sent.
 const endpoint=location.hostname==='openaigames.lens-frontier.workers.dev'?'https://openaigames.org/api/analytics/event':'/api/analytics/event';
 function send(kind,properties={}){
  if(window.OpenAIGamesPreview)return Promise.resolve(false);
  const body=JSON.stringify({id:crypto.randomUUID(),visitor,kind,source:channel,device,...properties});
  const attempt=()=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body,credentials:'omit',keepalive:true});
  const retry=()=>new Promise(resolve=>setTimeout(()=>attempt().then(r=>resolve(r.status===204)).catch(()=>resolve(false)),1500));
  return attempt().then(r=>r.status>=500?retry():r.status===204).catch(retry);
 }
 const hasFocus=()=>document.hasFocus()&&document.activeElement?.tagName!=='IFRAME';
 const now=()=>performance.now(),IDLE=60000,MAX=86400000;
 let settleVisit;const visitReady=new Promise(resolve=>{settleVisit=resolve;});
 let visit=null,ready=false,visible=document.visibilityState==='visible',focused=hasFocus(),last=now(),activity=last,activeMs=0,acknowledged=0,inflight=0;
 function advance(){
  const time=now(),gap=time-last;
  // A suspended device or throttled timer must not add a long unobserved interval.
  if(visit&&visible&&focused&&gap>=0&&gap<=10000)activeMs=Math.min(MAX,activeMs+Math.max(0,Math.min(time,activity+IDLE)-last));
  last=time;
 }
 function flush(){
  const total=Math.floor(activeMs);if(!ready||total<=Math.max(acknowledged,inflight))return;
  inflight=total;
  send('engagement',{visit,activeMs:total}).then(ok=>{if(ok)acknowledged=Math.max(acknowledged,total);if(inflight===total)inflight=0;});
 }
 function pageview(){
  if(visit||!visible||window.OpenAIGamesPreview)return;
  visit=crypto.randomUUID();last=activity=now();
  send('pageview',{id:visit,version:2}).then(ok=>{ready=ok;settleVisit(ok);if(ok)flush();});
 }
 function resume(){advance();visible=document.visibilityState==='visible';focused=hasFocus();last=activity=now();pageview();}
 document.addEventListener('visibilitychange',()=>{advance();visible=document.visibilityState==='visible';if(visible)resume();else flush();});
 window.addEventListener('focus',resume);
 window.addEventListener('blur',()=>{advance();focused=false;flush();});
 window.addEventListener('pagehide',()=>{advance();flush();visible=false;});
 window.addEventListener('pageshow',resume);
 const interact=()=>{advance();if(document.visibilityState!=='visible')return;focused=hasFocus();activity=now();};
 for(const name of ['pointerdown','pointermove','keydown','wheel','touchstart'])document.addEventListener(name,interact,{passive:true,capture:true});
 setInterval(advance,5000);setInterval(()=>{advance();flush();},30000);pageview();

 // Journeys share an opaque flow ID. Only explicit, allowlisted values leave the browser.
 let queue=Promise.resolve(),feedback=null;
 const handles=new Map(),sentSteps=new Set();
 function step(handle,name,props={}){
  if(!handle)return Promise.resolve(false);
  const dedupe=[handle.flow,handle.attempt||handle.flow,name].join(':');if(name!=='active'&&sentSteps.has(dedupe))return queue;if(name!=='active')sentSteps.add(dedupe);
  const event={visit:handle.visit,flow:handle.flow,attempt:handle.attempt||handle.flow,family:handle.family,step:name,...(handle.game?{game:handle.game}:{}),...(handle.parent?{parent:handle.parent}:{}),...props};
  queue=queue.then(()=>visitReady).then(ok=>{if(!handle.visit)handle.visit=visit;event.visit=handle.visit;return ok?send('step',event):false;}).catch(()=>false);return queue;
 }
 function begin(family,options={}){
  pageview();const flow=crypto.randomUUID(),handle={family,flow,visit,game:options.game,parent:options.parent};
  step(handle,'open');return handle;
 }
 function savedFlow(family,game=''){
  const name='oag-journey:'+family+':'+game;
  if(handles.get(name)?.expires>Date.now()){const handle=handles.get(name);if(family==='feedback')feedback=handle;return handle;}
  let handle;
  try{const entry=JSON.parse(sessionStorage.getItem(name)||'null');if(entry?.visitor===visitor&&entry.expires>Date.now()&&UUID.test(entry.handle?.flow)&&UUID.test(entry.handle?.visit))handle=entry.handle;}catch{}
  if(!handle)handle={...begin(family,{game}),expires:Date.now()+1800000};
  handles.set(name,handle);
  try{sessionStorage.setItem(name,JSON.stringify({visitor,handle,expires:Date.now()+1800000}));}catch{}
  if(family==='feedback')feedback=handle;
  return handle;
 }
 function attempt(handle,code='') {if(!handle)return null;const next={...handle,attempt:crypto.randomUUID()};step(next,'attempt',{code});return next;}
 async function headers(handle){
  if(!handle)return {};
  // Never delay a user write for analytics.
  // The collector may still be in flight; the server briefly retries correlation in the background.
  return ready?{'X-OAG-Telemetry':JSON.stringify({visitor,visit:handle.visit,flow:handle.flow,attempt:handle.attempt||handle.flow})}:{};
 }
 const errorCode=error=>error?.name==='AbortError'?'aborted':error?.name==='TimeoutError'?'timeout':error?.status===429?'rate_limited':[401,403].includes(error?.status)?'unauthorized':error?.status>=500?'server':error?.status?'invalid':'network';
 window.OpenAIGamesTelemetry=Object.freeze({begin,step,savedFlow,attempt,headers,errorCode,get feedback(){return feedback;},drain:()=>queue});
 // Capture the navigation itself so rendering a sign-in link never counts as an attempt.
 document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href]');if(!link||event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname!=='/api/auth/github/login')return;
  event.preventDefault();const handle=begin('login',{...(feedback&&url.searchParams.get('return')?.includes('#/comments/')?{parent:feedback.flow}: {})});
  url.searchParams.set('flow',handle.flow);
  Promise.race([queue,new Promise(resolve=>setTimeout(resolve,350))]).finally(()=>location.assign(url.href));
 });
 const room=begin('room'),roomStarted=now();let roomFinished=false;
 const roomDuration=()=>Math.min(MAX,Math.round(now()-roomStarted));
 window.addEventListener('openaigames-room-ready',()=>{if(roomFinished)return;roomFinished=true;step(room,'ready',{durationMs:roomDuration()});});
 window.addEventListener('openaigames-room-error',event=>{step(room,'error',{code:event.detail?.code==='webgl'?'webgl':'resource',durationMs:roomDuration()});roomFinished=true;});
 setTimeout(()=>{if(!roomFinished)step(room,'timeout',{code:'timeout',durationMs:roomDuration()});},45000);
 for(const [name,kind] of [['openaigames-game-open','play'],['openaigames-game-select','select']])window.addEventListener(name,event=>{if(typeof event.detail?.id==='string')send(kind,{game:event.detail.id});});
})();
