import test from 'node:test';
import assert from 'node:assert/strict';
import {SheetDrag} from '../lib/sheet-gesture.mjs';

test('a deliberate pull or quick downward flick dismisses a mobile sheet',()=>{
 const drag=new SheetDrag();
 drag.start(100,0);assert.equal(drag.move(170),70);assert.equal(drag.finish(230,600),true);
 drag.start(100,0);assert.equal(drag.finish(148,65),true);
});
test('small movements, upward scrolling and cancelled gestures keep the sheet open',()=>{
 const drag=new SheetDrag();
 drag.start(100,0);assert.equal(drag.finish(148,600),false);
 drag.start(100,0);assert.equal(drag.move(60),0);assert.equal(drag.finish(30,70),false);
 drag.start(100,0);assert.equal(drag.finish(240,300,true),false);
 drag.start(100,0);assert.equal(drag.finish(106,1),false);
});
