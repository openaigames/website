import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const script=await readFile('static/analytics.js','utf8');
const settled=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({store=new Map(),search='',host='openaigames.org',privacy=false,visible=true,fail=false}={}){
 const listeners={},calls=[],timeouts=[],intervals=[];let time=0;
 const window={};window.top=window;window.self=window;window.addEventListener=(name,fn)=>{listeners[name]=fn;};
 const document={visibilityState:visible?'visible':'hidden',referrer:'',focused:true,activeElement:null,hasFocus(){return this.focused;},addEventListener:(name,fn)=>{listeners[name]=fn;}};
 const context={window,document,navigator:{doNotTrack:privacy?'1':'0'},location:{hostname:host,pathname:'/',search},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},crypto,URL,URLSearchParams,performance:{now:()=>time},matchMedia:()=>({matches:false}),fetch:(url,options)=>{calls.push({url,event:JSON.parse(options.body)});return fail?Promise.reject(Error('offline')):Promise.resolve({status:204});},setTimeout:fn=>timeouts.push(fn),setInterval:(fn,ms)=>intervals.push({fn,ms})};
 vm.runInNewContext(script,context);
 return {listeners,calls,document,store,timeouts,window,advance(ms,{sample=true}={}){time+=ms;if(sample)intervals.find(i=>i.ms===5000)?.fn();},flush(){intervals.find(i=>i.ms===30000)?.fn();},heartbeats:()=>calls.filter(c=>c.event.kind==='engagement').map(c=>c.event)};
}
test('Client counts one visible document view; explicit selections and game opens retain browser identity',()=>{
 const f=fixture({search:'?utm_source=xhs&private=discard'});assert.equal(f.calls.length,1);assert.equal(f.calls[0].event.source,'xiaohongshu');assert.equal(f.calls[0].event.version,2);assert.ok(!JSON.stringify(f.calls).includes('private'));
 f.listeners.visibilitychange();f.listeners.visibilitychange();assert.equal(f.calls.length,1);
 f.listeners['openaigames-game-select']({detail:{id:'dodo'}});assert.equal(f.calls[1].event.kind,'select');
 f.listeners['openaigames-game-open']({detail:{id:'dodo'}});assert.equal(f.calls[2].event.kind,'play');
 const reload=fixture({store:f.store});assert.equal(reload.calls[0].event.visitor,f.calls[0].event.visitor);assert.notEqual(reload.calls[0].event.id,f.calls[0].event.id);
});
test('Hidden pages wait for visibility; opt-outs and previews do not collect; retry IDs remain stable',async()=>{
 const f=fixture({visible:false});assert.equal(f.calls.length,0);f.document.visibilityState='visible';f.listeners.visibilitychange();assert.equal(f.calls.length,1);
 for(const config of [{privacy:true},{host:'preview.openaigames.org'},{search:'?analytics=off'}])assert.equal(fixture(config).calls.length,0);
 const old=fixture({host:'openaigames.lens-frontier.workers.dev'});assert.equal(old.calls[0].url,'https://openaigames.org/api/analytics/event');
 const offline=fixture({fail:true});await settled();offline.timeouts[0]();assert.equal(offline.calls.length,2);assert.equal(offline.calls[0].event.id,offline.calls[1].event.id);
 await settled();offline.advance(5000);offline.flush();assert.equal(offline.heartbeats().length,0);
});
test('Active time excludes background, iframe focus, idle intervals and suspended device gaps',async()=>{
 const f=fixture();await settled();
 for(let i=0;i<6;i++)f.advance(5000);f.flush();await settled();assert.equal(f.heartbeats().at(-1).activeMs,30000);
 f.document.visibilityState='hidden';f.listeners.visibilitychange();for(let i=0;i<12;i++)f.advance(5000);f.flush();assert.equal(f.heartbeats().length,1);
 f.document.visibilityState='visible';f.listeners.visibilitychange();
 for(let i=0;i<14;i++)f.advance(5000);f.flush();await settled();assert.equal(f.heartbeats().at(-1).activeMs,90000);
 f.advance(5000);f.listeners.pointermove();for(let i=0;i<2;i++)f.advance(5000);
 f.document.activeElement={tagName:'IFRAME'};f.listeners.blur();await settled();assert.equal(f.heartbeats().at(-1).activeMs,100000);
 // Visibility restoration while the embedded game is focused is still excluded.
 f.listeners.pageshow();for(let i=0;i<6;i++)f.advance(5000);f.flush();assert.equal(f.heartbeats().at(-1).activeMs,100000);
 f.document.activeElement=null;f.listeners.focus();f.advance(600000);f.advance(5000);f.flush();assert.equal(f.heartbeats().at(-1).activeMs,100000);
 f.listeners.pointerdown();f.advance(5000);f.listeners.pagehide();await settled();assert.equal(f.heartbeats().at(-1).activeMs,105000);
 assert.equal(f.heartbeats()[0].visit,f.calls[0].event.id);
});
test('Exit flushes once, BFCache resumes the same visit and network retries do not duplicate duration',async()=>{
 const f=fixture();await settled();f.advance(5000);f.listeners.pagehide();f.listeners.pagehide();await settled();assert.equal(f.heartbeats().length,1);
 f.advance(60000);f.listeners.pageshow();f.advance(5000);f.flush();await settled();assert.equal(f.heartbeats().at(-1).activeMs,10000);
 f.flush();assert.equal(f.heartbeats().length,2);assert.equal(f.calls.filter(c=>c.event.kind==='pageview').length,1);
 const race=fixture();race.advance(5000);race.listeners.pagehide();assert.equal(race.heartbeats().length,0);await settled();assert.equal(race.heartbeats().length,1);assert.equal(race.heartbeats()[0].activeMs,5000);
});
