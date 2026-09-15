import test from 'node:test';
import assert from 'node:assert/strict';
import {bindGameRotation} from '../lib/game-rotation.mjs';

test('rotation fits resized viewports, resets on device rotation, and cleans up on game exit',()=>{
  const values={},attrs={},classes=new Set(),events=new EventTarget(),orientation=new EventTarget();
  events.screen={orientation};
  const frame={src:'https://game.example/',progress:42};
  const player={clientWidth:390,clientHeight:728,frame,style:{setProperty:(k,v)=>values[k]=v},classList:{toggle:(k,v)=>v?classes.add(k):classes.delete(k)}};
  const label={textContent:''},button={querySelector:()=>label,setAttribute:(k,v)=>attrs[k]=v};
  let resize,disconnected=false;
  class Observer{constructor(callback){resize=callback;}observe(){}disconnect(){disconnected=true;}}
  const control=bindGameRotation(player,button,{viewport:events,Observer});
  control.toggle();
  assert.ok(classes.has('game-rotated'));
  assert.equal(values['--rotated-game-width'],'728px');
  assert.equal(values['--rotated-game-height'],'390px');
  assert.equal(attrs['aria-pressed'],'true');
  player.clientWidth=844;player.clientHeight=290;resize();
  assert.equal(values['--rotated-game-width'],'290px');
  assert.equal(values['--rotated-game-height'],'844px');
  assert.equal(player.frame,frame);assert.equal(frame.progress,42);
  orientation.dispatchEvent(new Event('change'));
  assert.equal(attrs['aria-pressed'],'false');
  control.toggle();control.dispose();
  assert.ok(disconnected);assert.equal(classes.size,0);
  attrs['aria-pressed']='detached';events.dispatchEvent(new Event('orientationchange'));
  assert.equal(attrs['aria-pressed'],'detached','an exited game must no longer receive orientation events');
});
