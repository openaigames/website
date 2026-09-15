import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cabinetLayout} from '../lib/cabinet-layout.mjs';
test('Cabinet pagination keeps categories separate and retains every playable entry',()=>{
 const games=Array.from({length:29},(_,i)=>({id:String(i),category:i<18?'Action':'Adventure'}));
 const first=cabinetLayout(games);assert.equal(first.pages,3);
 const all=[];
 for(let page=0;page<first.pages;page++){
  const layout=cabinetLayout(games,page);assert.ok(layout.upper.length<=10);
  for(const shelf of layout.shelves){assert.ok(shelf.games.length<=8);assert.ok(shelf.games.every(game=>game.category===shelf.label));all.push(...shelf.games);}
 }
 assert.deepEqual(all,games);assert.equal(new Set(all.map(g=>g.id)).size,29);
 assert.equal(cabinetLayout(games,99).page,2);assert.equal(cabinetLayout([],99).page,0);
 assert.deepEqual(cabinetLayout([]).shelves,[]);
});
