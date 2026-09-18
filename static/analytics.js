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
  send('pageview',{id:visit,version:2}).then(ok=>{ready=ok;if(ok)flush();});
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
 for(const [name,kind] of [['openaigames-game-open','play'],['openaigames-game-select','select']])window.addEventListener(name,event=>{if(typeof event.detail?.id==='string')send(kind,{game:event.detail.id});});
})();
