import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const script=await readFile('static/analytics.js','utf8');
function fixture({store=new Map(),search='',host='openaigames.org',privacy=false,visible=true,fail=false}={}){
 const listeners={},calls=[],timeouts=[];const window={};window.top=window;window.self=window;window.addEventListener=(name,fn)=>{listeners[name]=fn;};
 const document={visibilityState:visible?'visible':'hidden',referrer:'',addEventListener:(name,fn)=>{listeners[name]=fn;}};
 const context={window,document,navigator:{doNotTrack:privacy?'1':'0'},location:{hostname:host,pathname:'/',search},localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},crypto,URL,URLSearchParams,matchMedia:()=>({matches:false}),fetch:(url,options)=>{calls.push({url,event:JSON.parse(options.body)});return fail?Promise.reject(Error('offline')):Promise.resolve({status:204});},setTimeout:fn=>timeouts.push(fn)};
 vm.runInNewContext(script,context);return {listeners,calls,document,store,timeouts};
}
test('Client counts one visible document view; game opens count separately and retain browser identity',()=>{
 const f=fixture({search:'?utm_source=xhs&private=discard'});assert.equal(f.calls.length,1);assert.equal(f.calls[0].event.source,'xiaohongshu');assert.ok(!JSON.stringify(f.calls).includes('private'));
 f.listeners.visibilitychange();f.listeners.visibilitychange();assert.equal(f.calls.length,1);
 f.listeners['openaigames-game-open']({detail:{id:'dodo'}});assert.equal(f.calls.length,2);assert.equal(f.calls[1].event.kind,'play');
 const reload=fixture({store:f.store});assert.equal(reload.calls[0].event.visitor,f.calls[0].event.visitor);assert.notEqual(reload.calls[0].event.id,f.calls[0].event.id);
});
test('Hidden pages wait for visibility; opt-outs and previews do not collect; retry IDs remain stable',async()=>{
 const f=fixture({visible:false});assert.equal(f.calls.length,0);f.document.visibilityState='visible';f.listeners.visibilitychange();assert.equal(f.calls.length,1);
 for(const config of [{privacy:true},{host:'preview.openaigames.org'}])assert.equal(fixture(config).calls.length,0);
 const old=fixture({host:'openaigames.lens-frontier.workers.dev'});assert.equal(old.calls[0].url,'https://openaigames.org/api/analytics/event');
 const offline=fixture({fail:true});await new Promise(resolve=>setImmediate(resolve));offline.timeouts[0]();assert.equal(offline.calls.length,2);assert.equal(offline.calls[0].event.id,offline.calls[1].event.id);
});
