import test from 'node:test';
import assert from 'node:assert/strict';
import {animationClock} from '../scene/animation-clock.mjs';

test('opening a panel midway through camera travel does not skip the rest on return',()=>{
  let time=100;const clock=animationClock(()=>time),start=clock.now();
  time=400;clock.setPaused(true);
  time=30400;assert.equal(clock.now()-start,300);
  clock.setPaused(false);assert.equal(clock.now()-start,300);
  time=30600;assert.equal(clock.now()-start,500);
});
test('nested panel navigation and repeated paused frames keep the same pause point',()=>{
  let time=0;const clock=animationClock(()=>time);
  clock.setPaused(true);time=100;clock.setPaused(true);time=200;
  assert.equal(clock.now(),0);clock.setPaused(false);
  time=300;clock.setPaused(false);assert.equal(clock.now(),100);
  clock.setPaused(true);time=1000;clock.setPaused(false);assert.equal(clock.now(),100);
});
test('a new cartridge animation created while fullscreen starts at zero when leaving it',()=>{
  let time=100;const clock=animationClock(()=>time);clock.setPaused(true);
  time=10100;const start=clock.now();clock.setPaused(false);
  assert.equal(clock.now()-start,0);time+=150;assert.equal(clock.now()-start,150);
});
