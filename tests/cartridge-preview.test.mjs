import test from 'node:test';
import assert from 'node:assert/strict';
import {cartridgePreview} from '../scene/cartridge-preview.mjs';

test('preview uses the TV gap while both side shelves and upper cartridges remain clear',()=>{
 const p=cartridgePreview({width:920,height:860,anchor:{x:460,y:495},occupied:[
  {left:45,top:260,right:895,bottom:340},{left:60,top:380,right:150,bottom:650},{left:775,top:380,right:895,bottom:650},
 ]});
 assert.equal(p.x,460);assert.equal(p.y,495);assert.ok(p.left>162&&p.right<763);assert.ok(p.top>352);
});
test('a cartridge at the first anchor moves the preview to an unobstructed position',()=>{
 const box={left:325,top:340,right:595,bottom:575};
 const p=cartridgePreview({width:920,height:860,anchor:{x:460,y:450},occupied:[box]});
 assert.ok(p);assert.ok(p.top>=box.bottom+12||p.bottom<=box.top-12||p.right<=box.left-12||p.left>=box.right+12);
});
test('crowded close-ups hide the floating preview instead of covering selectable cartridges',()=>{
 assert.equal(cartridgePreview({width:390,height:844,anchor:{x:195,y:420},occupied:[{left:0,top:0,right:390,bottom:844}]}),null);
});
