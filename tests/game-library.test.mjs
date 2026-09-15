import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionGames,unloadPlayer} from '../lib/game-library.mjs';

test('screen collections include playtests and ordinary games without hiding future releases',()=>{
  const projects=[{id:'featured',featured:true,current_version:'1'},{id:'regular',current_version:'1'},{id:'community',pending:true,current_version:'1'},{id:'draft'}];
  assert.deepEqual(collectionGames(projects,'featured').map(p=>p.id),['featured']);
  assert.deepEqual(collectionGames(projects,'playtest').map(p=>p.id),['community']);
  assert.deepEqual(collectionGames(projects,'all').map(p=>p.id),['featured','regular','community']);
});
test('ejection unloads every old game context immediately and can run repeatedly',()=>{
  const frames=[{src:'https://game-a.example/'},{src:'https://game-b.example/'}];
  const removed=[];
  frames.forEach(frame=>frame.remove=()=>{assert.equal(frame.src,'about:blank');removed.push(frame);});
  const root={querySelectorAll:selector=>{assert.equal(selector,'#player iframe');return frames.filter(frame=>!removed.includes(frame));}};
  unloadPlayer(root);unloadPlayer(root);
  assert.equal(removed.length,2);
});
