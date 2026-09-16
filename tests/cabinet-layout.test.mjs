import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cabinetLayout} from '../lib/cabinet-layout.mjs';
test('Cabinet pagination keeps categories separate and retains every playable entry',()=>{
 const games=Array.from({length:29},(_,i)=>({id:String(i),category:i<18?'Action':'Adventure'}));
 const first=cabinetLayout(games);assert.equal(first.pages,3);
 const all=[],upper=[];
 for(let page=0;page<first.pages;page++){
  const layout=cabinetLayout(games,page);assert.ok(layout.upper.length<=10);
  assert.deepEqual(layout.upper,layout.shelves.flatMap(shelf=>shelf.games),'upper row must show the same games as the category shelves');
  upper.push(...layout.upper);
  for(const shelf of layout.shelves){assert.ok(shelf.games.length<=8);assert.ok(shelf.games.every(game=>game.category===shelf.label));all.push(...shelf.games);}
 }
 assert.deepEqual(all,games);assert.equal(new Set(all.map(g=>g.id)).size,29);
 assert.deepEqual(upper,games,'every game must be shown face-out on exactly one page');
 assert.equal(cabinetLayout(games,99).page,2);assert.equal(cabinetLayout([],99).page,0);
 assert.deepEqual(cabinetLayout([]).shelves,[]);
});

test('flipping a small catalog with several categories changes the upper row as well as the side shelves',()=>{
 const games=[{id:'dodo',category:'肉鸽地牢'},{id:'nightfury',category:'街机赛车'},...Array.from({length:5},(_,i)=>({id:`demo-${i}`,category:'社区试玩'}))];
 const first=cabinetLayout(games,0),second=cabinetLayout(games,1);
 assert.equal(first.pages,2);
 assert.deepEqual(first.upper.map(g=>g.id),['dodo','nightfury']);
 assert.deepEqual(second.upper.map(g=>g.id),games.slice(2).map(g=>g.id));
 assert.ok(second.upper.every(game=>!first.upper.includes(game)),'the next page must not repeat the same upper row');
 assert.deepEqual(cabinetLayout(games,0),first,'going back restores the same cabinet');
});

test('cabinet capacity preserves every game for large, interleaved and uncategorized collections',()=>{
 for(const counts of [[0],[1],[10],[18],[8,8],[1,1,5],[25,3,14,1]]){
  const games=counts.flatMap((count,category)=>Array.from({length:count},(_,i)=>({id:`${category}-${i}`,category:category%2?`type-${category}`:''})));
  const first=cabinetLayout(games),seen=[];
  for(let page=0;page<first.pages;page++){
   const layout=cabinetLayout(games,page);
   assert.ok(layout.shelves.length<=2&&layout.shelves.every(s=>s.games.length<=8));
   assert.ok(layout.upper.length<=10);
   assert.deepEqual(layout.upper,layout.shelves.flatMap(s=>s.games));
   seen.push(...layout.upper.map(g=>g.id));
  }
  assert.deepEqual([...seen].sort(),games.map(g=>g.id).sort());
  assert.equal(new Set(seen).size,games.length);
 }
});
