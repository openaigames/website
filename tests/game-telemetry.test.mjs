import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindGameTelemetry} from '../scene/telemetry-player.mjs';
const uuid=()=>crypto.randomUUID();
function target(){const events=new Map();return {addEventListener(n,fn){if(!events.has(n))events.set(n,new Set());events.get(n).add(fn);},removeEventListener(n,fn){events.get(n)?.delete(fn);},emit(n,event){for(const fn of events.get(n)||[])fn(event);}};}
function fixture(){
 let time=0,hidden=false,overlay=false;const calls=[],messages=[],win=target(),doc=target(),frame=target();
 win.location={href:'https://openaigames.org/'};win.OpenAIGamesTelemetry={begin(family,{game}){const handle={family,game,flow:uuid()};calls.push({step:'open',handle});return handle;},step(handle,step,props={}){calls.push({handle,step,...props});}};
 Object.defineProperty(doc,'visibilityState',{get:()=>hidden?'hidden':'visible'});doc.hasFocus=()=>true;doc.body={classList:{contains:()=>overlay}};doc.querySelector=()=>null;
 frame.src='https://game.example/play';frame.contentWindow={postMessage:(data,origin)=>messages.push({data,origin})};
 const dispose=bindGameTelemetry(frame,'dodo',{window:win,document:doc,clock:()=>time});
 const nonce=messages[0].data.nonce;
 const send=(event,extra={},overrides={})=>win.emit('message',{source:frame.contentWindow,origin:'https://game.example',data:{type:'oag:telemetry:event',version:1,nonce,event,...extra},...overrides});
 return {calls,messages,frame,win,doc,dispose,send,advance(ms){time+=ms;},hide(){hidden=true;doc.emit('visibilitychange');},show(){hidden=false;doc.emit('visibilitychange');},cover(v){overlay=v;}};
}
test('iframe load is not ready; only the current frame, origin and nonce confirm gameplay',()=>{
 const f=fixture();try{
  f.frame.emit('load');assert.equal(f.calls.length,1);assert.ok(f.messages.every(m=>m.origin==='https://game.example'));
  f.send('ready',{}, {origin:'https://attacker.example'});f.send('ready',{}, {source:{}});f.send('ready',{nonce:uuid()});assert.equal(f.calls.length,1);
  f.advance(50);f.send('ready');f.send('ready');assert.equal(f.calls.filter(c=>c.step==='ready').length,1);
  f.send('start');f.advance(5000);f.send('active',{deltaMs:5000});f.dispose();
  assert.equal(f.calls.find(c=>c.step==='active').durationMs,5000);assert.equal(f.calls.filter(c=>c.step==='exit').length,1);
  const length=f.calls.length;f.send('ready');f.send('start');f.frame.emit('load');f.dispose();assert.equal(f.calls.length,length);
 }finally{f.dispose();}
});
test('Runtime excludes hidden/covered time, impossible deltas and activity before start',()=>{
 const f=fixture();try{
  f.advance(5000);f.send('active',{deltaMs:5000});f.send('start');assert.equal(f.calls.filter(c=>c.step==='start').length,0);
  f.send('ready');f.send('start');f.advance(5000);f.send('active',{deltaMs:5000});
  f.hide();f.advance(60000);f.send('active',{deltaMs:5000});f.show();
  f.cover(true);f.advance(5000);f.send('active',{deltaMs:5000});f.cover(false);
  f.advance(5000);f.send('active',{deltaMs:999999});f.send('active',{deltaMs:-1});f.send('active',{deltaMs:5000});f.send('active',{deltaMs:5000});
  f.dispose();assert.equal(f.calls.filter(c=>c.step==='active').at(-1).durationMs,10000);
 }finally{f.dispose();}
});
