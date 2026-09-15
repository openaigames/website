// Room gestures are separate from the game iframe and modal scrolling.
// Both pinch and wheel feed the same bounded camera paths.
export class RoomTouchGesture {
  constructor(handlers={}) { this.handlers=handlers;this.pointers=new Map();this.reset(); }
  reset() { this.pointers.clear();this.start=null;this.last=null;this.pinch=null;this.multiple=false;this.moved=false; }
  down(point,time=0) {
    if(!this.pointers.size){this.reset();this.start={...point,time};this.last=point;}
    this.pointers.set(point.id,point);
    if(this.pointers.size>=2){
      this.multiple=true;
      const [a,b]=this.pointers.values();
      this.pinch={distance:Math.hypot(b.x-a.x,b.y-a.y),anchor:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
      this.handlers.pinchStart?.(this.pinch.anchor);
    }
  }
  move(point) {
    if(!this.pointers.has(point.id))return;
    this.pointers.set(point.id,point);
    if(this.pointers.size>=2){
      const [a,b]=this.pointers.values(),distance=Math.hypot(b.x-a.x,b.y-a.y);
      if(this.pointers.size===2&&distance>12&&this.pinch?.distance>12){
        const delta=Math.max(-120,Math.min(120,600*Math.log(this.pinch.distance/distance)));
        if(Math.abs(delta)>.01)this.handlers.zoom?.(delta,this.pinch.anchor);
      }
      this.pinch.distance=distance;return;
    }
    // Lifting one finger after a pinch must never become a tap or one-finger drag.
    if(this.multiple)return;
    if(!this.moved&&Math.hypot(point.x-this.start.x,point.y-this.start.y)>8){
      this.moved=true;this.handlers.dragStart?.(this.start);
    }
    if(this.moved)this.handlers.drag?.({dx:point.x-this.last.x,dy:point.y-this.last.y,target:this.start.target});
    this.last=point;
  }
  up(point,time=0,cancelled=false) {
    if(!this.pointers.has(point.id))return;
    const tap=!cancelled&&!this.multiple&&!this.moved&&time-this.start.time<650&&Math.hypot(point.x-this.start.x,point.y-this.start.y)<=8;
    this.pointers.delete(point.id);
    if(this.pointers.size===2){const [a,b]=this.pointers.values();this.pinch.distance=Math.hypot(b.x-a.x,b.y-a.y);}
    if(tap)this.handlers.tap?.({...point,target:this.start.target});
    if(!this.pointers.size){this.reset();this.handlers.end?.();}
  }
}

export function bindRoomTouch(surface,{canStart,...handlers}) {
  const gesture=new RoomTouchGesture(handlers),options={capture:true,passive:false};
  let suppressClickUntil=0;
  const point=e=>({id:e.pointerId,x:e.clientX,y:e.clientY,target:e.target});
  const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
  const down=e=>{
    if(e.pointerType!=='touch'||(!gesture.pointers.size&&!canStart(e)))return;
    consume(e);surface.setPointerCapture(e.pointerId);gesture.down(point(e),performance.now());
  };
  const move=e=>{if(gesture.pointers.has(e.pointerId)){consume(e);gesture.move(point(e));}};
  const up=e=>{
    if(!gesture.pointers.has(e.pointerId))return;
    consume(e);suppressClickUntil=performance.now()+700;
    gesture.up(point(e),performance.now(),e.type==='pointercancel');
    if(surface.hasPointerCapture(e.pointerId))surface.releasePointerCapture(e.pointerId);
  };
  const click=e=>{if(e.isTrusted&&e.detail!==0&&performance.now()<suppressClickUntil)consume(e);};
  const reset=()=>{
    for(const id of gesture.pointers.keys())if(surface.hasPointerCapture(id))surface.releasePointerCapture(id);
    gesture.reset();handlers.end?.();
  };
  surface.addEventListener('pointerdown',down,options);surface.addEventListener('pointermove',move,options);
  surface.addEventListener('pointerup',up,options);surface.addEventListener('pointercancel',up,options);
  surface.addEventListener('click',click,true);
  window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
  return {reset,dispose(){reset();surface.removeEventListener('pointerdown',down,true);surface.removeEventListener('pointermove',move,true);surface.removeEventListener('pointerup',up,true);surface.removeEventListener('pointercancel',up,true);surface.removeEventListener('click',click,true);window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);}};
}
