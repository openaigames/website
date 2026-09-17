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
 function send(kind,game){if(window.OpenAIGamesPreview)return;const event={id:crypto.randomUUID(),visitor,kind,source:channel,device,...(game?{game}:{})};const body=JSON.stringify(event);const attempt=()=>fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body,credentials:'omit',keepalive:true});attempt().then(r=>{if(r.status>=500)setTimeout(()=>attempt().catch(()=>{}),1500);}).catch(()=>setTimeout(()=>attempt().catch(()=>{}),1500));}
 let viewed=false;const pageview=()=>{if(viewed||document.visibilityState!=='visible')return;viewed=true;send('pageview');};
 document.addEventListener('visibilitychange',pageview);pageview();
 window.addEventListener('openaigames-game-open',event=>{if(typeof event.detail?.id==='string')send('play',event.detail.id);});
})();
