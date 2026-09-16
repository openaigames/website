// Only the grab handle dismisses a sheet; scrolling or editing its content never does.
export class SheetDrag {
 start(y,time=0){this.origin=y;this.time=time;this.offset=0;}
 move(y){this.offset=Math.max(0,y-this.origin);return this.offset;}
 finish(y,time,cancelled=false){const offset=this.move(y),speed=offset/Math.max(1,time-this.time);return !cancelled&&(offset>96||offset>35&&speed>.55);}
}
export function bindSheetDismiss(surface,handle,close,enabled){
 let pointer=null,drag=new SheetDrag();
 const reset=()=>{if(pointer!==null&&handle.hasPointerCapture(pointer))handle.releasePointerCapture(pointer);pointer=null;surface.classList.remove('sheet-dragging');surface.style.removeProperty('--sheet-offset');};
 handle.addEventListener('pointerdown',event=>{
  if(pointer!==null||!enabled()||event.button!==0)return;event.preventDefault();pointer=event.pointerId;drag.start(event.clientY,event.timeStamp);handle.setPointerCapture(pointer);surface.classList.add('sheet-dragging');
 });
 handle.addEventListener('pointermove',event=>{if(event.pointerId!==pointer)return;event.preventDefault();surface.style.setProperty('--sheet-offset',`${Math.min(surface.clientHeight,drag.move(event.clientY))}px`);});
 for(const type of ['pointerup','pointercancel'])handle.addEventListener(type,event=>{if(event.pointerId!==pointer)return;const dismiss=drag.finish(event.clientY,event.timeStamp,event.type==='pointercancel');reset();if(dismiss)close();});
 window.addEventListener('blur',reset);
 return {reset};
}
