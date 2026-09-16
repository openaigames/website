import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { cable } from './models.mjs';
import { nightRoom } from './night-room.mjs';
import { cabinetLayout } from '../lib/cabinet-layout.mjs';
import { containCamera, cameraPath, cameraPose, overviewPath, syncOrbitPose } from './camera-motion.mjs';
import { focusAreaForRay, focusDestination, cabinetDetailForRay, panCabinetPath, canScrollList, wheelGoal, resizeFocusPath, roomFov, roomHome } from './room-focus.mjs';
import { bindRoomTouch } from './touch-navigation.mjs';
import { bindCabinetDrag } from './cabinet-navigation.mjs';
import { panRoomPose } from './room-pan.mjs';
import { animationClock } from './animation-clock.mjs';
import { cartridgePreview } from './cartridge-preview.mjs';
const motionClock=animationClock();
const root=document.createElement('section');root.id='three-room';root.setAttribute('aria-label','OpenAIGames 三维游戏空间');
root.innerHTML=`<div id="three-canvas"></div><div id="three-html"></div><div class="three-loading" role="status"><strong>OpenAIGames</strong><span>正在搬来你的游戏机…</span><i></i></div><div class="scene-tip" id="scene-tip">拖动，转一转。点一张卡带，开始玩。</div><div class="three-footer"><button data-action="submit-demo">＋ 投稿游戏</button><button id="scene-library">选卡</button><a href="https://github.com/openaigames/community" target="_blank" rel="noopener">逛社区 ↗</a><button data-action="sound" aria-label="开关按键音">音效</button></div><button id="exit-immersive" class="exit-immersive">↙ 回到游戏机</button><div class="three-controls" id="three-controls"><button data-action="eject">退卡</button><button data-action="start">START</button><button data-action="edit">一起改</button><button data-action="feedback">反馈</button></div>`;
let roomLayout,cabinetPage=0,approachPath=null,approachProgress=0,approachGoal=0;
let approachArea='screen',approachDetail=null,wheelPointer=null,approachHistory=[];
let touchNavigation,cabinetNavigation,touchCabinetPan=false,lastZoomAt=0,cabinetDetailReady=false;
let roomPanActive=false,roomPanning=false,lastViewport=null;
let renderer,cssRenderer,scene,camera,orbit,screenObject,tv,consoleMesh,pad,rackCards=[],liveCart,manual;
let dirty=true,focus=false,tween=null,drag=null,down=null,hover=null,held=null,latest=null,booted=false,disposed=false,inserting=false,insertGeneration=0,hoverCard=null,immersive=false,fullPending=false,fullRect=null,fullscreenAnimation=null,cardSource=null,cardArt=null,rackKey="",fullOriginalTransform="",inspection=null,inspectionId=null,inspectionProgress=0;
const loader=new GLTFLoader(),texLoader=new T.TextureLoader(),raycaster=new T.Raycaster(),pointer=new T.Vector2();
const activeMeshes=[],animations=[];
let inspectionFrame=null;
const homeTarget=new T.Vector3(-.5,1.1,1.2),homeCamera=new T.Vector3(12.5,11.4,27.3);
const host=()=>window.OpenAIGamesHost;
const $=s=>document.querySelector(s);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function textTexture(text,w=1024,h=128,bg='#142c56',fg='#c1e6ff',size=64,sub=''){
 if(typeof text==='string')text=window.OpenAIGamesI18n?.t(text)||text;
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,w,h);x.fillStyle=fg;x.font=`600 ${size}px "Avenir Next", "PingFang SC", sans-serif`;x.textAlign='center';x.textBaseline='middle';
 if(Array.isArray(text)){
  const widths=text.map(run=>x.measureText(run.text).width),total=widths.reduce((a,b)=>a+b,0),scale=Math.min(1,w*.92/total);
  x.save();x.translate((w-total*scale)/2,h/2);x.scale(scale,1);x.textAlign='left';let offset=0;
  text.forEach((run,i)=>{x.fillStyle=run.color||fg;x.fillText(run.text,offset,0);offset+=widths[i];});x.restore();
 }else x.fillText(text,w/2,sub?h*.34:h/2,w*.92);
 if(sub){x.font=`400 ${Math.round(size*.35)}px monospace`;x.fillText(sub,w/2,h*.76,w*.88);}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
function applyLabel(object,name,text,options={}){const m=object.getObjectByName(name);if(!m)return;const map=textTexture(text,options.w||1024,options.h||128,options.bg||'#af965f',options.fg||'#5d2330',options.size||64,options.sub||'');m.material=new T.MeshBasicMaterial({map,toneMapped:false,transparent:false,side:T.FrontSide});m.material.map.flipY=true;}
function labelHardware(){
 applyLabel(tv,'tv_brand','OpenAIGames',{bg:'#335cb7',fg:'#c1d8ff'});
 applyLabel(consoleMesh,'console_brand','OpenAIGames',{bg:'#ed783b',fg:'#152c55'});
 for(const name of ['power','restart'])applyLabel(consoleMesh,name+'_label',name==='power'?'POWER':'RESET',{bg:'#c5dcfa',fg:'#244d93',size:44});
 applyLabel(pad,'controller_brand','OpenAIGames',{bg:'#2d59b8',fg:'#c5dcfa',size:58});
 for(const name of ['start','select'])applyLabel(pad,name+'_label',name.toUpperCase(),{bg:'#2d59b8',fg:'#c5dcfa',size:51});
 for(const [name,label] of [['back','B'],['action','A']])applyLabel(pad,name+'_label',label,{bg:'#101d35',fg:'#e89a54',w:128,h:128,size:88});
 applyLabel(manual,'manual_cover',window.OpenAIGamesI18n?.t('怎么玩')||'怎么玩',{bg:'#92b5db',fg:'#122850',w:512,h:700,size:100,sub:'OpenAIGames'});
}
function addTargets(group){group.traverse(o=>{if(o.isMesh&&(o.userData.action||o.userData.direction||o.userData.card||o.userData.screen||o.userData.manual))activeMeshes.push(o);});}
function sceneCard(card,p){
 card.userData.project=p;card.traverse(o=>{if(o.isMesh){o.userData.card=p.id;o.castShadow=true;o.receiveShadow=true;}});
 const material=new T.MeshStandardMaterial({map:textTexture(p.title,768,768,'#173d76','#d2e9ff',60),roughness:.58,metalness:0});
 card.getObjectByName('cart_art').material=material;
 if(p.cover_url)texLoader.load(p.cover_url,texture=>{if(!rackCards.includes(card)){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;material.map.dispose();material.map=texture;material.needsUpdate=true;dirty=true;},undefined,()=>{});
 applyLabel(card,'cart_title',p.title,{w:768,h:96,bg:'#193968',fg:'#d2e9ff',size:54});
 const status=[p.featured?'精选':p.pending?'待补资料':'已收录',p.development_stage||p.version_label||'试玩版'].map(text=>window.OpenAIGamesI18n?.t(text)||text).join(' · ');
 const statusLabel=new T.Mesh(new T.PlaneGeometry(1.27,.16),new T.MeshBasicMaterial({map:textTexture(status,1024,128,p.featured?'#f58a3b':'#173967',p.featured?'#152747':'#d8e8ff',68)}));statusLabel.name='cart_status';statusLabel.position.set(0,.245,.168);statusLabel.userData.card=p.id;card.add(statusLabel);

 const i=[...p.id].reduce((sum,c)=>sum+c.charCodeAt(0),0)%6;
 const shell=card.getObjectByName('cart_shell');shell.material=shell.material.clone();shell.material.color.set(['#ff8b45','#326cdf','#5689c9','#df6935','#224f99','#608eaf'][i]);card.getObjectByName('cart_top_lip').material=shell.material;
 const canvas=document.createElement('canvas');canvas.width=160;canvas.height=1024;const ctx=canvas.getContext('2d');ctx.fillStyle='#14284a';ctx.fillRect(0,0,160,1024);ctx.translate(80,512);ctx.rotate(-Math.PI/2);ctx.fillStyle='#e1efff';ctx.font='600 65px "PingFang SC",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(window.OpenAIGamesI18n?.t(p.title)||p.title,0,0,900);
 const spineMap=new T.CanvasTexture(canvas);spineMap.colorSpace=T.SRGBColorSpace;const spine=new T.Mesh(new T.PlaneGeometry(.225,1.12),new T.MeshBasicMaterial({map:spineMap}));spine.name='cartridge_spine';spine.position.set(-.812,.77,0);spine.rotation.y=-Math.PI/2;spine.userData.card=p.id;card.add(spine);
}
function registerCart(card){addTargets(card);}
function refreshRack(){
 if(!cardSource||!roomLayout||inserting||drag)return;
 const all=host().state().projects.filter(p=>p.current_version);
 let recent=[];try{recent=JSON.parse(localStorage.getItem('openaigames-recent')||'[]');}catch{}if(!Array.isArray(recent))recent=[];
 const picks=[...new Set([...all.filter(p=>p.featured).map(p=>p.id),...recent])].map(id=>all.find(p=>p.id===id)).filter(Boolean).slice(0,2);
 const layout=cabinetLayout(all,cabinetPage);cabinetPage=layout.page;
 const key=(window.OpenAIGamesI18n?.locale||'zh')+':'+all.map(p=>p.id+':'+p.title+':'+p.category+':'+p.cover_url+':'+p.development_stage+':'+p.featured).join('|')+':'+cabinetPage+':'+picks.map(p=>p.id).join('|');if(key===rackKey)return;
 rackKey=key;hoverCard=null;hover=null;clearInspection();
 for(const c of rackCards){scene.remove(c);c.traverse(o=>{const i=activeMeshes.indexOf(o);if(i>=0)activeMeshes.splice(i,1);if(o.isMesh&&['cart_art','cart_title','cartridge_spine','cart_status'].includes(o.name)){o.material.map?.dispose();o.material.dispose();if(['cartridge_spine','cart_status'].includes(o.name))o.geometry.dispose();}if(o.name==='cart_shell')o.material.dispose();});}
 const placements=[...layout.shelves.flatMap((shelf,side)=>shelf.games.map((p,i)=>({p,position:roomLayout.cabinetPosition(side,i),rotation:new T.Euler(0,Math.PI/2,0)}))),...layout.upper.map((p,i)=>({p,position:roomLayout.upperPosition(layout.upperSlots[i]),rotation:new T.Euler(0,0,0)})),...picks.map((p,i)=>({p,position:roomLayout.deskPosition(i),rotation:new T.Euler(-.2,-.24,0)}))];
 rackCards=placements.map(({p,position,rotation})=>{const card=cardSource.clone(true);sceneCard(card,p);card.position.copy(position);card.rotation.copy(rotation);card.scale.setScalar(.93);card.userData.home=card.position.clone();card.userData.homeQ=card.quaternion.clone();scene.add(card);registerCart(card);return card;});
 roomLayout.updateCabinet(layout);
 for(const button of root.querySelectorAll('[data-room-action="previous"],[data-room-action="next"]')){button.disabled=layout.pages===1;button.hidden=layout.pages===1;}
 dirty=true;renderer.shadowMap.needsUpdate=true;
}
function roomAction(action){
 if(action==='music'){window.OpenAIGamesMusic?.open();return;}
 if(action==='github'){window.open('https://github.com/openaigames','_blank','noopener,noreferrer');return;}
 if(action==='search'){window.OpenAIGamesSite.open('games','',{search:true});return;}
 if(action==='previous'||action==='next'){const layout=cabinetLayout(host().state().projects.filter(p=>p.current_version),cabinetPage);cabinetPage=(cabinetPage+(action==='next'?1:-1)+layout.pages)%layout.pages;refreshRack();return;}
 window.OpenAIGamesSite.open(({catalog:'games',submit:'submit',board:'board',community:'community'}[action]||'games'));
}
function mountRoomActions(){
 const navigation=document.createElement('nav');navigation.className='room-accessible-actions';navigation.setAttribute('aria-label','场景内功能');
 navigation.innerHTML=roomLayout.actions.map(([action,label])=>`<button type="button" data-room-action="${action}">${label}</button>`).join('');root.append(navigation);
 navigation.addEventListener('click',event=>{const button=event.target.closest('[data-room-action]');if(button)roomAction(button.dataset.roomAction);});
}
function hitCard(mesh){for(let o=mesh;o;o=o.parent)if(o.userData.project)return o;return locateCard(mesh?.userData.card);}
function previewFrame(){
 const point=new T.Vector3(),box=new T.Box3();
 const occupied=rackCards.filter(card=>card.visible).map(card=>{
  box.setFromObject(card);const corners=[];
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){point.set(x,y,z).project(camera);corners.push({x:(point.x+1)*innerWidth/2,y:(1-point.y)*innerHeight/2});}
  return {left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};
 });
 screenObject.getWorldPosition(point).project(camera);
 return cartridgePreview({width:innerWidth,height:innerHeight,anchor:{x:(point.x+1)*innerWidth/2,y:(1-point.y)*innerHeight/2},occupied});
}
function clearInspection(){root.classList.remove('inspecting');if(!inspection)return;scene.remove(inspection);inspection.traverse(o=>{if(o.isMesh)o.material.dispose();});inspection=null;inspectionId=null;inspectionProgress=0;}
function setCardHover(card){
 if(hoverCard===card)return;hoverCard=card;
 if(card&&!inserting&&!focus&&!isCabinetCloseup()&&matchMedia('(hover:hover)').matches){
  clearInspection();inspectionFrame=previewFrame();if(!inspectionFrame){dirty=true;return;}inspection=card.clone(true);inspectionId=card.userData.project.id;inspectionProgress=0;
  inspection.traverse(o=>{if(o.isMesh){o.userData={inspection:true};o.raycast=()=>{};o.material=o.material.clone();o.material.transparent=true;o.material.opacity=0;o.castShadow=false;o.receiveShadow=false;}});scene.add(inspection);root.classList.add('inspecting');
 }
 dirty=true;
}
function animateCardHover(){
 let moving=false;
 for(const card of rackCards){if(card===drag?.card||!card.visible||card.userData.returning)continue;const target=card.userData.home.clone();if(card===hoverCard&&!inserting&&!focus)target.y+=.12;if(card.position.distanceToSquared(target)>.00001){card.position.lerp(target,reduced?1:.2);moving=true;}card.quaternion.copy(card.userData.homeQ);card.scale.setScalar(.93);}
 if(inspection){
  const desired=hoverCard&&!inserting&&!focus?1:0;
  inspectionProgress=reduced?desired:inspectionProgress+(desired-inspectionProgress)*.22;
  if(Math.abs(inspectionProgress-desired)<.001)inspectionProgress=desired;else moving=true;
  if(!desired&&inspectionProgress===0){clearInspection();return true;}
  const distance=13,halfHeight=distance*Math.tan(T.MathUtils.degToRad(camera.fov/2));
  const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion),forward=new T.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const size=inspectionFrame.size*(2*halfHeight)/(innerHeight*1.8)*(.94+.06*inspectionProgress);
  inspection.position.copy(camera.position).addScaledVector(forward,distance).addScaledVector(right,(inspectionFrame.x/innerWidth*2-1)*halfHeight*camera.aspect).addScaledVector(up,(1-inspectionFrame.y/innerHeight*2)*halfHeight-.74*size);
  inspection.quaternion.copy(camera.quaternion);inspection.scale.setScalar(size);inspection.traverse(o=>{if(o.isMesh)o.material.opacity=inspectionProgress;});
 }
 return moving;
}
function returnCard(card){
 card.userData.returning=true;card.userData.lift=0;const from=card.position.clone(),home=card.userData.home.clone(),q=card.quaternion.clone(),scale=card.scale.x,above=new T.Vector3(home.x,3,home.z);
 animations.push({start:motionClock.now(),duration:reduced?0:650,tick:t=>{const a=t<.6?t/.6:(t-.6)/.4,e=a*a*(3-2*a);card.position.lerpVectors(t<.6?from:above,t<.6?above:home,e);card.quaternion.slerpQuaternions(q,card.userData.homeQ,t);card.scale.setScalar(T.MathUtils.lerp(scale,.93,t));},end:()=>{card.userData.returning=false;}});dirty=true;
}
function fullscreen(){if(immersive)return;fullPending=true;if(!focus||tween)cameraTo('screen');else enterFullscreen();}
function enterFullscreen(){
 if(immersive)return;
 fullPending=false;fullRect=screenObject.element.getBoundingClientRect();fullOriginalTransform=screenObject.element.style.transform;immersive=true;orbit.enabled=false;const el=screenObject.element;root.classList.add('immersive');el.style.transform='none';el.style.pointerEvents='auto';el.style.transformOrigin='0 0';
 fullscreenAnimation=el.animate([{transform:`translate(${fullRect.x}px,${fullRect.y}px) scale(${fullRect.width/innerWidth},${fullRect.height/innerHeight})`,borderRadius:'11px'},{transform:'none',borderRadius:'0px'}],{duration:reduced?0:650,easing:'cubic-bezier(.22,1,.36,1)'});
}
function exitFullscreen(){
 fullPending=false;if(!immersive)return;
 fullscreenAnimation?.cancel();fullscreenAnimation=null;immersive=false;
 root.classList.remove('immersive');const el=screenObject.element;
 el.style.transformOrigin='';el.style.transform=fullOriginalTransform;
 cssRenderer.render(scene,camera);dirty=true;
}
function returnToRoom(){host()?.action('eject');exitFullscreen();cameraTo('overview');hint('拖动环视，滚轮控制远近。');}

window.OpenAIGamesScene={fullscreen,exitFullscreen:returnToRoom,isImmersive:()=>immersive,
 prepareOverlay:()=>{setCardHover(null);clearInspection();host()?.bridge('release');motionClock.setPaused(true);dirty=true;},
 play:id=>{if(!booted||disposed)return false;if(inserting)return true;if(host().state().route==='game'&&host().state().selected===id&&$('#player iframe')){fullscreen();return true;}exitFullscreen();if(locateCard(id)){insert(id);}else{host().pick(id);host().start();fullscreen();}return true;},
 browse:()=>{if(!booted||disposed)return;host()?.stop();setCardHover(null);if(inserting){insertGeneration++;inserting=false;animations.length=0;if(liveCart){scene.remove(liveCart);liveCart=null;}rackCards.forEach(card=>{card.visible=true;card.position.copy(card.userData.home);card.quaternion.copy(card.userData.homeQ);card.userData.returning=false;});}cameraTo('overview');}
};
function cartridgeSlot(){return consoleMesh.localToWorld(new T.Vector3(0,.77,-.36));}
function aboveCartridgeSlot(){const slot=cartridgeSlot();slot.y=3;return slot;}
function locateCard(id){return rackCards.find(c=>c.userData.project.id===id);}
function hint(text){$('#scene-tip').textContent=text;}
function readSize(){
 const width=innerWidth,height=innerHeight;
 if(lastViewport?.width===width&&lastViewport.height===height)return;
 // A software keyboard must not reset the room behind a form.
 if(lastViewport?.width===width&&document.activeElement?.matches('input,textarea,select'))return;
 const first=!lastViewport,atHome=!approachPath&&!tween&&camera.position.distanceTo(homeCamera)<.1&&orbit.target.distanceTo(homeTarget)<.1;
 setCardHover(null);clearInspection();hover=null;
 lastViewport={width,height};touchNavigation?.reset();cabinetNavigation?.reset();
 renderer.setSize(width,height);cssRenderer.setSize(width,height);camera.aspect=width/height;camera.fov=roomFov(camera.aspect);camera.updateProjectionMatrix();
 const home=roomHome(camera.aspect);homeCamera.copy(home.position);homeTarget.copy(home.target);
 if(!booted||immersive){dirty=true;return;}
 if(approachPath){
  const screen=new T.Vector3();screenObject.getWorldPosition(screen);
  approachPath=resizeFocusPath(approachPath,approachArea,camera.aspect,screen,approachDetail,camera.fov);
  const pose=cameraPose(approachPath,approachProgress);camera.position.copy(pose.position);orbit.target.copy(pose.target);camera.lookAt(orbit.target);
  if(tween)startCameraTravel(approachPath,approachProgress,approachGoal,'approach',120);
 }else if(first||atHome)cameraTo('overview',first?650:240);
 else{containCamera(camera.position,orbit.target);camera.lookAt(orbit.target);}
 dirty=true;
}
function setScreenFocus(value){
 focus=value;root.classList.toggle('screen-view',focus);screenObject.element.style.pointerEvents=focus?'auto':'none';
 $('#three-controls').classList.toggle('show',focus&&latest?.route==='game');
}
function startCameraTravel(path,from,to,mode,duration=1100){
 setCardHover(null);setScreenFocus(false);orbit.enabled=false;
 tween={path,from,to,mode,start:motionClock.now(),duration:reduced?0:duration};dirty=true;
}
function prepareApproach(area='screen',detail=null){
 if(approachPath&&approachArea===area&&!detail)return;
 if(approachPath&&approachProgress>0)approachHistory.push({path:approachPath,progress:approachProgress,area:approachArea,detail:approachDetail});
 if(!tween)syncOrbitPose(orbit);
 const screen=new T.Vector3();screenObject.getWorldPosition(screen);
 const destination=focusDestination(area,camera.aspect,screen,detail,camera.fov);
 approachArea=area;approachDetail=detail;root.dataset.focusArea=area;
 approachPath=cameraPath(camera.position,orbit.target,destination.position,destination.target);approachProgress=approachGoal=0;
}
function cameraTo(mode,duration=1100){
 if(immersive)exitFullscreen();
 if(mode==='screen'){
  prepareApproach();approachGoal=1;startCameraTravel(approachPath,approachProgress,1,'approach');
 }else{
  roomPanActive=false;fullPending=false;approachPath=null;approachDetail=null;approachHistory=[];approachProgress=approachGoal=0;wheelPointer=null;root.dataset.focusArea='room';
  syncOrbitPose(orbit);
  const path=overviewPath(camera.position,orbit.target,homeCamera,homeTarget);
  if(path)startCameraTravel(path,0,1,'overview',duration);
  else{tween=null;setScreenFocus(false);orbit.enabled=true;}
 }
}
function wheelApproach(event){
 if(event.target.closest?.('.room-music,.music-launcher'))return;
 if(!booted||disposed||immersive||inserting||drag||document.body.classList.contains('site-open')||$('#dialog').open||event.ctrlKey)return;
 const horizontal=event.deltaX||(event.shiftKey?event.deltaY:0);
 if(isCabinetCloseup()&&Math.abs(horizontal)>Math.abs(event.shiftKey?0:event.deltaY)){
  event.preventDefault();beginCabinetPan();panCabinet(-horizontal*(event.deltaMode===1?16:event.deltaMode===2?innerWidth:1));return;
 }
 const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);if(!delta)return;
 if(event.target.closest?.('input,textarea,select'))return;
 const list=event.target.closest?.('.game-list');if(list&&canScrollList(list,delta))return;
 event.preventDefault();
 zoomRoom(delta,event);
}
function zoomRoom(delta,event){
 root.classList.add('navigation-used');
 const now=performance.now();if(now-lastZoomAt>220)cabinetDetailReady=approachArea==='cabinet'&&approachProgress>=.985;lastZoomAt=now;
 if(delta>0&&!approachPath){
  if(tween?.mode!=='overview')cameraTo('overview',200);
  return;
 }
 // Lock a gesture to its original object while the scene moves underneath the
 // pointer. Deliberately moving the pointer selects another area on zoom-in.
 if(delta<0&&(!approachPath||!wheelPointer||Math.hypot(event.clientX-wheelPointer.x,event.clientY-wheelPointer.y)>32)){
  const hit=getHit(event),card=hit?.userData.card?(hoverCard||hitCard(hit)):null;
  let area=focusAreaForRay(raycaster.ray)||'desk';
  if(card){const home=card.userData.home;area=home&&(home.z<-2||home.y>5)?'cabinet':'desk';}
  if(event.target.closest?.('#screen'))area='screen';
  prepareApproach(area);wheelPointer={x:event.clientX,y:event.clientY};
 }
 // Once the whole cabinet is in view, another inward gesture inspects the
 // pointed shelf. Keep this as a second reversible leg, with a bounded endpoint.
 if(delta<0&&cabinetDetailReady&&approachArea==='cabinet'&&approachProgress>=.985&&!approachDetail){
  getHit(event);
  const detail=focusAreaForRay(raycaster.ray)==='cabinet'?cabinetDetailForRay(raycaster.ray):null;
  if(detail)prepareApproach('cabinet',detail);
 }
 if(!approachPath)prepareApproach();
 const next=wheelGoal(approachProgress,approachGoal,delta);
 if(next===approachGoal)return;approachGoal=next;
 startCameraTravel(approachPath,approachProgress,next,'approach',120);
}

function isCabinetCloseup(){return Boolean(approachPath&&approachArea==='cabinet'&&approachDetail&&approachProgress>.1&&!immersive&&!inserting);}
function wantsRoomPan(){return roomPanActive||approachProgress>.1;}
function beginRoomPan(){
 roomPanning=true;
 if(isCabinetCloseup()){beginCabinetPan();return;}
 tween=null;approachPath=null;approachDetail=null;approachHistory=[];approachProgress=approachGoal=0;wheelPointer=null;
 roomPanActive=true;
 setScreenFocus(false);setCardHover(null);clearInspection();syncOrbitPose(orbit);orbit.enabled=false;
}
function panRoom(dx,dy){
 if(isCabinetCloseup()){panCabinet(dx,dy);return;}
 const pose=panRoomPose(camera.position,orbit.target,dx,dy,innerHeight,camera.fov);
 camera.position.copy(pose.position);orbit.target.copy(pose.target);camera.lookAt(orbit.target);dirty=true;
}
function beginCabinetPan(){
 tween=null;approachGoal=approachProgress;wheelPointer=null;setCardHover(null);clearInspection();syncOrbitPose(orbit);orbit.enabled=false;
}
function panCabinet(dx,dy=0){
 if(!isCabinetCloseup())return;
 const next=panCabinetPath(approachPath,approachProgress,approachDetail,dx,innerHeight,camera.fov,dy);
 approachPath=next.path;approachDetail=next.detail;
 const pose=cameraPose(approachPath,approachProgress);camera.position.copy(pose.position);orbit.target.copy(pose.target);camera.lookAt(orbit.target);dirty=true;
}
function enableTouchNavigation(){
 const guide=document.createElement('div');guide.className='room-entry-guide';guide.innerHTML='<span class="entry-mouse">滑动滚轮进入</span><span class="entry-touch">双指缩放进入 · 单指拖动环视</span>';root.append(guide);
 root.addEventListener('pointerdown',()=>root.classList.add('navigation-used'),{once:true});
 touchNavigation=bindRoomTouch(root,{
  canStart:event=>booted&&!disposed&&!immersive&&!inserting&&!document.body.classList.contains('site-open')&&!$('#dialog').open&&Boolean(event.target.closest?.('#three-canvas,#screen'))&&!event.target.closest?.('input,textarea,select'),
  pinchStart:()=>{touchCabinetPan=false;lastZoomAt=0;wheelPointer=null;setCardHover(null);syncOrbitPose(orbit);root.classList.add('touch-used');},
  panStart:()=>{touchCabinetPan=true;beginRoomPan();},
  pan:({dx,dy})=>panRoom(dx,dy),
  zoom:(delta,anchor)=>zoomRoom(delta,{clientX:anchor.x,clientY:anchor.y,target:root}),
  dragStart:point=>{
   root.classList.add('touch-used');
   if(point.target.closest?.('#screen'))return;
   touchCabinetPan=wantsRoomPan();if(touchCabinetPan){beginRoomPan();return;}
   tween=null;approachPath=null;approachDetail=null;approachHistory=[];approachProgress=approachGoal=0;wheelPointer=null;
   root.dataset.focusArea='room';setScreenFocus(false);syncOrbitPose(orbit);orbit.enabled=false;
  },
  drag:({dx,dy,target})=>{
   if(target.closest?.('#screen')){const list=target.closest('.game-list');if(list)list.scrollTop-=dy;return;}
   if(touchCabinetPan){panRoom(dx,dy);return;}
   orbit.rotateLeft(dx/innerHeight*Math.PI*1.4);orbit.rotateUp(dy/innerHeight*Math.PI*1.4);
   containCamera(camera.position,orbit.target);camera.lookAt(orbit.target);dirty=true;
  },
  tap:point=>{
   const button=point.target.closest?.('#screen button');
   if(button){button.click();return;}
   perform(touchHit(point));
   if(held){host()?.bridge('keyup',held);held=null;}
  },
  end:()=>{touchCabinetPan=false;roomPanning=false;orbit.enabled=!immersive&&!focus&&!tween;}
 });
 cabinetNavigation=bindCabinetDrag(root,{
  active:event=>booted&&!disposed&&!immersive&&!inserting&&(wantsRoomPan()||event.button===2||event.shiftKey)&&!document.body.classList.contains('site-open')&&!$('#dialog').open,
  begin:beginRoomPan,pan:panRoom,tap:event=>perform(getHit(event)),
  end:()=>{roomPanning=false;orbit.enabled=!immersive&&!focus&&!tween;}
 });
 renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
}
function pressMesh(m){if(!m)return;const y=m.position.y;animations.push({start:motionClock.now(),duration:170,tick:t=>{m.position.y=y-Math.sin(t*Math.PI)*.027;},end:()=>m.position.y=y});dirty=true;}
async function perform(m){try{if(!host()||!m)return;const d=m.userData;if(d.roomAction){roomAction(d.roomAction);return;}if(d.card){await insert(d.card,hitCard(m));return;}if(d.screen){cameraTo('screen');return;}if(d.manual){host().action('manual');return;}if(d.direction){if(latest?.route==='game')host().bridge('keydown',d.direction);else host().move(['ArrowUp','ArrowLeft'].includes(d.direction)?-1:1);held=d.direction;pressMesh(m);return;}pressMesh(m);if(d.action==='action'){if(latest?.route==='game')host().bridge('action');else host().action('start');}else if(d.action==='eject'||d.action==='back'){host().action('eject');cameraTo('overview');}else{host().action(d.action);if(d.action==='start'&&latest?.power)cameraTo('screen');}}catch(error){host().toast(error.message);}}
async function insert(id,source){if(inserting)return;const original=source||locateCard(id);if(!original||original.userData.returning)return;inserting=true;const generation=++insertGeneration;setCardHover(null);host().pick(id);if(liveCart){scene.remove(liveCart);liveCart=null;}
 const cart=original.clone(true);cart.traverse(o=>{if(o.isMesh)o.userData={};});scene.add(cart);const pose=original;cart.position.copy(pose.position);cart.quaternion.copy(pose.quaternion);cart.scale.copy(pose.scale);clearInspection();original.visible=false;const from=cart.position.clone(),fromQ=cart.quaternion.clone(),to=cartridgeSlot(),toQ=new T.Quaternion(),fromScale=cart.scale.x;liveCart=cart;hint('把这一张，装进游戏机。');let cameraStarted=false;
 const fromShelf=from.z<-2,flightHeight=fromShelf?Math.max(from.y,3.6):Math.max(from.y+1.5,3.6),lifted=new T.Vector3(from.x,fromShelf?from.y:flightHeight,fromShelf?-.6:from.z),aboveSlot=new T.Vector3(to.x,flightHeight,to.z);
 animations.push({start:motionClock.now(),duration:reduced?0:1500,tick:t=>{
  const phase=t<.22?0:t<.7?1:2;
  const raw=phase===0?t/.22:phase===1?(t-.22)/.48:(t-.7)/.3,e=raw*raw*(3-2*raw);
  cart.position.lerpVectors(phase===0?from:phase===1?lifted:aboveSlot,phase===0?lifted:phase===1?aboveSlot:to,e);
  const turn=T.MathUtils.smoothstep(t,fromShelf?.22:0,.66);cart.quaternion.slerpQuaternions(fromQ,toQ,turn);cart.scale.setScalar(T.MathUtils.lerp(fromScale,consoleMesh.scale.x,turn));
  if(t>.74&&!cameraStarted&&generation===insertGeneration){cameraStarted=true;cameraTo('screen');}
 },end:()=>{original.visible=true;original.position.copy(original.userData.home);original.quaternion.copy(original.userData.homeQ);original.scale.setScalar(.93);original.userData.lift=0;if(generation!==insertGeneration)return;inserting=false;if(host().state().power){host().start();fullscreen();hint('咔哒。点击游戏画面，开始玩。');}}});dirty=true;
}
function overSlot(e){const p=cartridgeSlot().add(new T.Vector3(0,.14*consoleMesh.scale.x,0)).project(camera);return Math.hypot(e.clientX-(p.x+1)*innerWidth/2,e.clientY-(1-p.y)*innerHeight/2)<Math.min(70,innerWidth*.085);}
function getHit(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(scene.children,true).find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return h.object.isMesh;});if(!hit)return;const m=hit.object;return activeMeshes.includes(m)||m.userData.inspection?m:undefined;}
// Nearby hit samples make small physical labels usable with a fingertip.
function touchHit(point){
 const center=getHit({clientX:point.x,clientY:point.y});if(center)return center;
 for(const [dx,dy] of [[-12,0],[12,0],[0,-12],[0,12],[-18,-10],[18,-10],[-18,10],[18,10]]){
  const hit=getHit({clientX:point.x+dx,clientY:point.y+dy});if(hit)return hit;
 }
}
function sync(){if(!host()||!booted)return;const previous=latest;latest=host().state();if(previous&&previous.route!==latest.route&&!inserting)latest.route==='game'?fullscreen():cameraTo('overview');$('#three-controls').classList.toggle('show',focus&&latest.route==='game');const led=tv.getObjectByName('power_light');led.material.emissiveIntensity=latest.power?1.7:0;led.material.color.set(latest.power?'#ed6140':'#55382b');
 if(!latest.power&&inserting){inserting=false;insertGeneration++;}
 if((latest.route!=='game'||!latest.power)&&liveCart&&!inserting){scene.remove(liveCart);liveCart=null;rackCards.forEach(c=>c.visible=true);}
 refreshRack();dirty=true;
}
async function init(){
 const url=new URL(location.href);if(url.searchParams.has('view')){url.searchParams.delete('view');history.replaceState(history.state,'',url);}
 try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{fallback('暂时无法开启 3D 房间，请重试。');return;}
 document.body.appendChild(root);root.querySelector('#three-canvas').appendChild(renderer.domElement);renderer.domElement.tabIndex=-1;document.body.classList.add('is-3d');
 scene=new T.Scene();scene.background=new T.Color('#050c1b');scene.fog=new T.Fog('#050c1b',38,75);
 camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.1,100);camera.position.copy(homeCamera);
 const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<700;
 renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.035).texture;scene.environmentIntensity=.35;
 const key=new T.DirectionalLight('#87adff',1.8);key.position.set(-5,11,8);key.castShadow=true;key.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);key.shadow.camera.left=-10;key.shadow.camera.right=10;key.shadow.camera.top=10;key.shadow.camera.bottom=-10;key.shadow.normalBias=.015;key.shadow.bias=-.0001;scene.add(key);
 const fill=new T.DirectionalLight('#ffb276',1.05);fill.position.set(6,5,-4);scene.add(fill);scene.add(new T.HemisphereLight('#8ebfff','#101b38',.85));
 orbit=new OrbitControls(camera,renderer.domElement);orbit.target.copy(homeTarget);orbit.enableDamping=true;orbit.dampingFactor=.09;orbit.minDistance=8.3;orbit.maxDistance=44;orbit.minAzimuthAngle=-.5;orbit.maxAzimuthAngle=.9;orbit.maxPolarAngle=Math.PI*.46;orbit.minPolarAngle=.18;orbit.enablePan=false;orbit.enableZoom=false;orbit.addEventListener('change',()=>dirty=true);
 cssRenderer=new CSS3DRenderer();root.querySelector('#three-html').appendChild(cssRenderer.domElement);cssRenderer.domElement.style.pointerEvents='none';
 const [tvData,bodyData,padData,cartData,bookData,art]=await Promise.all([loader.loadAsync('/static/models/television.glb'),loader.loadAsync('/static/models/console.glb'),loader.loadAsync('/static/models/controller.glb'),loader.loadAsync('/static/models/cartridge.glb'),loader.loadAsync('/static/models/manual.glb'),texLoader.loadAsync('/static/games/dodo/title.png')]);
 tv=tvData.scene.children[0];consoleMesh=bodyData.scene.children[0];pad=padData.scene.children[0];manual=bookData.scene.children[0];
 tv.position.set(0,1.6,-2.3);consoleMesh.position.set(-1.1,0,1.25);consoleMesh.scale.setScalar(1.2);pad.position.set(-5.3,0,2.9);pad.scale.setScalar(.9);pad.rotation.y=.18;manual.position.set(-4.6,0,-.15);manual.rotation.y=.28;
 for(const group of [tv,consoleMesh,pad]){group.traverse(o=>{if(o.isMesh){o.castShadow=!o.name.includes('label');o.receiveShadow=true;}});scene.add(group);}
 const mask=tv.getObjectByName('screen_surface');mask.userData.screen=true;mask.castShadow=false;mask.receiveShadow=false;mask.material=new T.MeshBasicMaterial({color:0x000000,opacity:0,blending:T.NoBlending,depthWrite:true});manual.traverse(o=>{if(o.isMesh)o.userData.manual=true;});
 labelHardware();[tv,consoleMesh,pad].forEach(addTargets);
 scene.add(cable([[-.38,.6,-.33],[.5,.08,-.3],[1.6,.06,-1.2],[2.5,1.9,-2.7]]));
 roomLayout=nightRoom({scene,texture:textTexture,targets:activeMeshes,invalidate:()=>{dirty=true;}});await roomLayout.ready;mountRoomActions();
 cardSource=cartData.scene.children[0];cardArt=art;refreshRack();
 const screen=document.getElementById('screen');screen.classList.add('three-screen');screen.style.width='640px';screen.style.height='445px';screen.style.pointerEvents='none';screenObject=new CSS3DObject(screen);screenObject.scale.setScalar(4.96/640);screenObject.position.set(-.2,4.21,-2.3+.854);scene.add(screenObject);
 renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(inserting)return;const m=getHit(e);down={x:e.clientX,y:e.clientY,mesh:m,time:performance.now()};if(m?.userData.direction){orbit.enabled=false;perform(m);}else if(m?.userData.card){orbit.enabled=false;const card=hitCard(m);drag={card,home:card.userData.home.clone(),homeRotation:new T.Euler().setFromQuaternion(card.userData.homeQ),startX:e.clientX,startY:e.clientY,moved:false};renderer.domElement.setPointerCapture(e.pointerId);} });
 renderer.domElement.addEventListener('pointermove',e=>{if(down&&!drag&&orbit.enabled&&approachPath&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>.5){approachPath=null;approachDetail=null;approachHistory=[];approachProgress=approachGoal=0;wheelPointer=null;root.dataset.focusArea='room';}if(drag){const distance=Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY);if(distance>8)drag.moved=true;if(drag.moved){getHit(e);const plane=new T.Plane(new T.Vector3(0,1,0),-3),point=new T.Vector3();if(raycaster.ray.intersectPlane(plane,point)){point.x=T.MathUtils.clamp(point.x,-2.5,6.2);point.z=T.MathUtils.clamp(point.z,.9,5.8);if(overSlot(e)){const slot=cartridgeSlot();point.x=slot.x;point.z=slot.z;}drag.card.position.set(point.x,3,point.z);drag.card.rotation.set(0,0,0);drag.card.scale.setScalar(1);hint(point.distanceTo(aboveCartridgeSlot())<1.4?'松手，插入卡带。':'把卡带拖到主机的插槽上。');dirty=true;}}return;}const m=getHit(e);if(m!==hover){hover=m;setCardHover(m?.userData.card?hitCard(m):null);renderer.domElement.style.cursor=m?'pointer':'grab';if(m?.userData.card)hint(locateCard(m.userData.card).userData.project.title+' · 点一下或拖入卡槽');else if(m?.userData.roomAction==='github')hint('在新标签打开 GitHub');else if(m?.userData.screen)hint('点击屏幕，坐近一点。');else if(m?.userData.manual)hint('翻开使用手册');else if(m?.userData.action)hint({power:'打开 / 关闭电源',eject:'退回卡带',restart:'重新开始',sound:'开关按键音',start:'开始 / 暂停',select:'切换 / 暂停',back:'返回',action:'A · 确认 / 动作'}[m.userData.action]||'按下按钮');else if(!focus)hint('拖动，转一转。点一张卡带，开始玩。');}});
 renderer.domElement.addEventListener('pointerleave',()=>{if(!drag){setCardHover(null);hover=null;}});
 const release=e=>{if(held){host().bridge('keyup',held);held=null;}if(drag){const d=drag;drag=null;const inSlot=overSlot(e)||d.card.position.distanceTo(aboveCartridgeSlot())<1.4;if(!d.moved||inSlot){insert(d.card.userData.project.id,d.card);}else{setCardHover(null);returnCard(d.card);hint('卡带放回盒子。点一下也能插卡。');}dirty=true;}else if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<7&&performance.now()-down.time<700&&!down.mesh?.userData.direction)perform(down.mesh);down=null;orbit.enabled=!focus&&!tween;};
 renderer.domElement.addEventListener('pointerup',release);renderer.domElement.addEventListener('pointercancel',()=>{if(drag){returnCard(drag.card);drag=null;}if(held){host().bridge('keyup',held);held=null;}down=null;orbit.enabled=!focus&&!tween;dirty=true;});
 window.addEventListener('wheel',wheelApproach,{capture:true,passive:false});
 // The screen's start button expands the same live player; route rendering keeps it full-window.
 screen.addEventListener('click',event=>{
  if(focus&&!immersive&&host().state().power&&event.target.closest('[data-action="start"]')&&host().state().projects.find(p=>p.id===host().state().selected)?.current_version)enterFullscreen();
 },true);
 document.getElementById('exit-immersive').onclick=returnToRoom;document.getElementById('scene-library').onclick=()=>{host().action('eject');cameraTo('screen');};
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&immersive&&!document.body.classList.contains('site-open')&&!document.getElementById('dialog').open){e.preventDefault();e.stopImmediatePropagation();returnToRoom();}},true);
 window.addEventListener('openaigames-language',()=>{if(booted&&!disposed){refreshRack();applyLabel(manual,'manual_cover',window.OpenAIGamesI18n?.t('怎么玩')||'怎么玩',{bg:'#92b5db',fg:'#122850',w:512,h:700,size:100,sub:'OpenAIGames'});dirty=true;}});window.addEventListener('openaigames-state',sync);window.addEventListener('resize',readSize);window.addEventListener('keydown',e=>{if(document.body.classList.contains('site-open'))return;if(e.key==='Escape'&&!document.getElementById('dialog').open){cameraTo('overview');}});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback('三维显示暂时不可用，请重新打开房间。');});
 booted=true;enableTouchNavigation();readSize();sync();root.querySelector('.three-loading').remove();
 if(host().state().route==='game')fullscreen();
 function frame(){if(disposed)return;requestAnimationFrame(frame);const covered=document.hidden||immersive||document.body.classList.contains('site-open')||$('#dialog').open;motionClock.setPaused(covered);if(covered)return;let moving=false;const now=motionClock.now();if(!roomPanning&&!immersive&&!tween&&!focus&&!approachProgress){orbit.update();containCamera(camera.position,orbit.target);camera.lookAt(orbit.target);}
  if(tween){
   const travel=tween,t=travel.duration?Math.min(1,(now-travel.start)/travel.duration):1,e=1-Math.pow(1-t,3),progress=T.MathUtils.lerp(travel.from,travel.to,e);
   const pose=cameraPose(travel.path,progress);orbit.target.copy(pose.target);camera.position.copy(pose.position);camera.lookAt(orbit.target);
   if(travel.mode==='approach')approachProgress=progress;
   if(t>=1){
    tween=null;syncOrbitPose(orbit);const arrived=travel.mode==='approach'&&travel.to===1&&approachArea==='screen';setScreenFocus(arrived);if(!arrived)orbit.enabled=true;
    if(travel.mode==='overview'||travel.to===0){
     const previous=travel.mode==='approach'?approachHistory.pop():null;
     approachPath=previous?.path||null;approachDetail=previous?.detail||null;approachProgress=approachGoal=previous?.progress||0;wheelPointer=null;
     if(previous)approachArea=previous.area;root.dataset.focusArea=previous?.area||'room';orbit.enabled=true;
     if(!previous&&travel.mode==='approach')cameraTo('overview',200);
    }
    if(fullPending&&arrived){cssRenderer.render(scene,camera);enterFullscreen();}
   }
   moving=true;
  }
  for(let i=animations.length-1;i>=0;i--){const a=animations[i],t=a.duration?Math.min(1,(now-a.start)/a.duration):1;a.tick(t);if(t>=1){a.end?.();animations.splice(i,1);}moving=true;}
  const objectsMoving=animateCardHover()||animations.length>0;moving||=objectsMoving;if(objectsMoving)renderer.shadowMap.needsUpdate=true;if(dirty||moving){const screenWorld=new T.Vector3();screenObject.getWorldPosition(screenWorld);screenObject.element.style.visibility=camera.position.z>screenWorld.z+.3?'visible':'hidden';renderer.render(scene,camera);if(!immersive)cssRenderer.render(scene,camera);root.dataset.drawCalls=String(renderer.info.render.calls);dirty=false;}
 }
 frame();
 };
function fallback(message){
 disposed=true;touchNavigation?.dispose();cabinetNavigation?.dispose();renderer?.dispose();document.body.classList.remove('is-3d');
 if(!root.isConnected)document.body.append(root);
 root.innerHTML=`<div class="scene-error" role="alert"><h1>房间暂时没有打开</h1><p>${message||'请检查连接后重试。'}</p><button type="button" id="retry-room">重新打开房间</button><button type="button" id="fallback-catalog">打开游戏目录</button></div>`;
 root.querySelector('#retry-room').onclick=()=>location.reload();root.querySelector('#fallback-catalog').onclick=()=>window.OpenAIGamesSite.open('games');
}
async function ready(){for(let i=0;i<100&&!host()?.state().projects.length;i++)await new Promise(r=>setTimeout(r,100));if(!host())return;try{await init();}catch(error){console.error('3D scene failed',error);fallback('三维资源暂未载入，请检查连接后重试。');}}
ready();
