// Capture mouse drags before OrbitControls and cartridge pickup in shelf close-up.
// Touch uses the shared room gesture recognizer and the same pan callback.
export function bindCabinetDrag(surface,{active,begin,pan,tap,end}){
  let drag=null;
  const consume=e=>{e.preventDefault();e.stopImmediatePropagation();};
  const reset=()=>{
    if(!drag)return;
    if(surface.hasPointerCapture(drag.id))surface.releasePointerCapture(drag.id);
    drag=null;surface.classList.remove('cabinet-dragging');end();
  };
  const down=e=>{
    if(e.pointerType==='touch'||e.button!==0||!e.target.closest('#three-canvas')||!active())return;
    consume(e);drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,moved:false};
    surface.setPointerCapture(e.pointerId);begin();
  };
  const move=e=>{
    if(!drag||e.pointerId!==drag.id)return;consume(e);
    if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>8)drag.moved=true;
    if(drag.moved){surface.classList.add('cabinet-dragging');pan(e.clientX-drag.lastX);}
    drag.lastX=e.clientX;
  };
  const up=e=>{
    if(!drag||e.pointerId!==drag.id)return;consume(e);
    const clicked=!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<=8;
    reset();if(clicked&&e.type!=='pointercancel')tap(e);
  };
  for(const [name,handler] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up]])surface.addEventListener(name,handler,{capture:true,passive:false});
  window.addEventListener('blur',reset);
  return {reset,dispose(){reset();for(const [name,handler] of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',up]])surface.removeEventListener(name,handler,true);window.removeEventListener('blur',reset);}};
}
