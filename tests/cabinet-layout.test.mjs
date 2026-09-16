import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cabinetLayout} from '../lib/cabinet-layout.mjs';
const featured=[{id:'dodo',category:'肉鸽地牢',featured:true},{id:'nightfury',category:'街机赛车',featured:true}];
const demos=n=>Array.from({length:n},(_,i)=>({id:`demo-${i}`,category:i%2?'冒险':'社区试玩'}));
test('Featured games stay on the left and community playtests on the right without unnecessary pages',()=>{
 const games=[...featured,...demos(7)],layout=cabinetLayout(games);
 assert.equal(layout.pages,1);
 assert.deepEqual(layout.shelves[0].games,featured);assert.deepEqual(layout.shelves[1].games,demos(7));
 assert.equal(layout.upper.length,9);assert.equal(cabinetLayout(games,1).page,0);
 assert.deepEqual(cabinetLayout([...games].reverse()),layout,'source refresh order does not move cartridges');
 assert.deepEqual(layout.upperSlots,[0,1,2,3,4,5,6,7,8]);
});
test('Only overflowing collections turn pages; featured anchors stay fixed and every page differs',()=>{
 const games=[...featured,...demos(19)],first=cabinetLayout(games),seen=[];assert.equal(first.pages,3);
 for(let page=0;page<first.pages;page++){
  const layout=cabinetLayout(games,page);assert.deepEqual(layout.shelves[0].games,featured);
  assert.deepEqual(layout.upperSlots.slice(0,2),[0,1]);assert.equal(layout.upperSlots[2],2);
  seen.push(...layout.shelves[1].games);
  if(page)assert.notDeepEqual(layout.upper,cabinetLayout(games,page-1).upper);
 }
 assert.deepEqual(seen,demos(19));assert.equal(cabinetLayout(games,999).page,2);
});
test('Large, empty and uneven collections keep all games within physical cabinet capacity',()=>{
 for(const [left,right] of [[0,0],[0,20],[1,1],[2,8],[2,9],[8,8],[25,3],[25,31],[33,0]]){
  const games=[...Array.from({length:left},(_,i)=>({id:`feature-${i}`,featured:true})),...demos(right)];
  const first=cabinetLayout(games),seen=new Set();
  for(let page=0;page<first.pages;page++){
   const layout=cabinetLayout(games,page);assert.equal(layout.shelves.length,2);
   assert.ok(layout.shelves.every(s=>s.games.length<=8));assert.ok(layout.upper.length<=10);
   assert.ok(layout.shelves[0].games.every(g=>g.featured));assert.ok(layout.shelves[1].games.every(g=>!g.featured));
   assert.equal(new Set(layout.upperSlots).size,layout.upper.length);assert.ok(layout.upperSlots.every(n=>n>=0&&n<10));
   layout.upper.forEach(g=>seen.add(g.id));
   if(page)assert.notDeepEqual(layout.upper,cabinetLayout(games,page-1).upper);
  }
  assert.deepEqual([...seen].sort(),games.map(g=>g.id).sort());
 }
});
