import test from 'node:test';
import assert from 'node:assert/strict';
import {RoomTouchGesture} from '../scene/touch-navigation.mjs';

const point=(id,x,y=100)=>({id,x,y,target:'canvas'});
function setup(withPan=false){
 const calls={taps:[],drags:[],zooms:[],pans:[],panStarts:0,starts:0,ends:0};
 const gesture=new RoomTouchGesture({tap:p=>calls.taps.push(p),drag:p=>calls.drags.push(p),zoom:(delta,anchor)=>calls.zooms.push({delta,anchor}),dragStart:()=>calls.starts++,end:()=>calls.ends++,...(withPan?{pan:p=>calls.pans.push(p),panStart:()=>calls.panStarts++}:{})});
 return {gesture,calls};
}
test('a short touch taps once while single-finger movement only rotates',()=>{
 const {gesture,calls}=setup();
 gesture.down(point(1,40),0);gesture.up(point(1,43),100);
 assert.equal(calls.taps.length,1);
 gesture.down(point(1,40),200);gesture.move(point(1,60));gesture.move(point(1,85));gesture.up(point(1,85),300);
 assert.equal(calls.starts,1);assert.equal(calls.drags.length,2);assert.equal(calls.taps.length,1);
});
test('pinch spread approaches, pinch closed retreats, and the midpoint stays anchored',()=>{
 const {gesture,calls}=setup();gesture.down(point(1,100));gesture.down(point(2,200));
 gesture.move(point(1,80));gesture.move(point(2,220));
 assert.ok(calls.zooms.every(z=>z.delta<0));
 assert.ok(calls.zooms.every(z=>z.anchor.x===150&&z.anchor.y===100));
 gesture.move(point(2,180));assert.ok(calls.zooms.at(-1).delta>0);
 gesture.up(point(2,180),100);gesture.move(point(1,130));gesture.up(point(1,130),150);
 assert.equal(calls.taps.length,0);assert.equal(calls.drags.length,0);assert.equal(calls.ends,1);
});
test('a second finger cancels a possible cartridge tap and a cancelled gesture leaves no stuck touch',()=>{
 const {gesture,calls}=setup();gesture.down(point(1,100));gesture.down(point(2,160));
 gesture.up(point(1,100),40,true);gesture.up(point(2,160),60);
 assert.equal(calls.taps.length,0);assert.equal(gesture.pointers.size,0);
 gesture.down(point(1,50),100);gesture.up(point(1,50),200);
 assert.equal(calls.taps.length,1);
 gesture.down(point(1,50),300);gesture.reset();gesture.up(point(1,50),350);
 assert.equal(calls.taps.length,1);
});
test('adding a third finger never turns into a game launch',()=>{
 const {gesture,calls}=setup();
 gesture.down(point(1,50));gesture.down(point(2,150));gesture.down(point(3,100));
 gesture.move(point(3,140));gesture.up(point(1,50),50);gesture.move(point(2,180));
 gesture.up(point(2,180),100);gesture.up(point(3,140),120);
 assert.equal(calls.taps.length,0);assert.equal(calls.drags.length,0);
});
test('moving two fingers together pans, without zooming or launching a cartridge on release',()=>{
 const {gesture,calls}=setup(true);
 gesture.down(point(1,80));gesture.down(point(2,180));
 gesture.move(point(1,105,120));gesture.move(point(2,205,120));
 gesture.move(point(1,120,140));gesture.move(point(2,220,140));
 assert.equal(calls.panStarts,1);assert.equal(calls.zooms.length,0);
 assert.equal(calls.pans.reduce((sum,p)=>sum+p.dx,0),40);
 assert.equal(calls.pans.reduce((sum,p)=>sum+p.dy,0),40);
 gesture.up(point(2,220,140),100);gesture.move(point(1,130,150));gesture.up(point(1,130,150),160);
 assert.equal(calls.taps.length,0);assert.equal(calls.drags.length,0);assert.equal(calls.ends,1);
});
test('spreading and closing two fingers keeps zoom available when panning is enabled',()=>{
 const {gesture,calls}=setup(true);
 gesture.down(point(1,100));gesture.down(point(2,200));
 gesture.move(point(1,80));gesture.move(point(2,220));
 assert.ok(calls.zooms.length>0);assert.ok(calls.zooms.every(p=>p.delta<0));
 gesture.move(point(1,110));gesture.move(point(2,190));
 assert.ok(calls.zooms.at(-1).delta>0);assert.equal(calls.pans.length,0);
 assert.ok(calls.zooms.every(p=>p.anchor.x===150));
 gesture.up(point(1,110),100,true);gesture.up(point(2,190),120,true);
 assert.equal(calls.taps.length,0);assert.equal(gesture.pointers.size,0);
});
