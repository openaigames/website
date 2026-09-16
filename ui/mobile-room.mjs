import {bindSheetDismiss} from '../lib/sheet-gesture.mjs';
const mobile=()=>matchMedia('(max-width:600px), (max-width:1000px) and (max-height:500px)').matches;
for(const [selector,close] of [['#room-panel',()=>window.OpenAIGamesSite?.close()],['#room-music-panel',()=>window.OpenAIGamesMusic?.close()]]){
 const surface=document.querySelector(selector);if(!surface)continue;
 const grip=document.createElement('div');grip.className='sheet-grip';grip.setAttribute('aria-hidden','true');grip.innerHTML='<span></span>';surface.prepend(grip);
 bindSheetDismiss(surface,grip,close,mobile);
}
const scrim=document.createElement('button');scrim.className='music-scrim';scrim.type='button';scrim.setAttribute('aria-label','关闭音乐面板');scrim.tabIndex=-1;scrim.addEventListener('click',()=>window.OpenAIGamesMusic?.close());document.body.append(scrim);
let frame;
function viewport(){
 cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
  const view=window.visualViewport,height=view?.height||innerHeight,inset=Math.max(0,innerHeight-height-(view?.offsetTop||0));
  document.documentElement.style.setProperty('--visual-height',`${height}px`);
  document.documentElement.style.setProperty('--keyboard-inset',`${inset}px`);
  if(inset>100&&document.activeElement?.matches('input,textarea,select'))document.activeElement.scrollIntoView({block:'nearest',behavior:'instant'});
 });
}
window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);window.addEventListener('resize',viewport);viewport();
