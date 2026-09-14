import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { cable } from './models.mjs';
const root=document.createElement('section');root.id='three-room';root.setAttribute('aria-label','OpenAIGames 三维游戏空间');
root.innerHTML=`<div id="three-canvas"></div><div id="three-html"></div><header class="three-header"><a class="three-brand" href="#/discover">OpenAIGames<small>社区游戏展厅</small></a><div class="view-keys"><button id="view-overview" class="active">环视</button><button id="view-screen">靠近屏幕</button><button id="view-fullscreen">全屏玩</button><button data-action="manual">怎么玩</button></div></header><div class="three-loading" role="status"><strong>OpenAIGames</strong><span>正在搬来你的游戏机…</span><i></i></div><div class="scene-tip" id="scene-tip">拖动，转一转。点一张卡带，开始玩。</div><div class="three-footer"><button data-action="submit-demo">＋ 投稿游戏</button><button id="scene-library">选卡</button><a href="https://github.com/openaigames/community" target="_blank" rel="noopener">逛社区 ↗</a><button data-action="sound" aria-label="开关按键音">音效</button><button id="scene-flat">基础视图</button></div><button id="exit-immersive" class="exit-immersive">↙ 回到游戏机</button><div class="three-controls" id="three-controls"><button data-action="eject">退卡</button><button data-action="start">START</button><button data-action="edit">一起改</button><button data-action="feedback">反馈</button></div>`;
let renderer,cssRenderer,scene,camera,orbit,screenObject,tv,consoleMesh,pad,rackCards=[],liveCart,manual;
let dirty=true,focus=false,tween=null,drag=null,down=null,hover=null,held=null,latest=null,booted=false,disposed=false,inserting=false,insertGeneration=0,hoverCard=null,immersive=false,fullPending=false,fullRect=null,fullscreenAnimation=null,cardSource=null,cardArt=null,rackKey="",fullOriginalTransform="",inspection=null,inspectionId=null,inspectionProgress=0;
const loader=new GLTFLoader(),texLoader=new T.TextureLoader(),raycaster=new T.Raycaster(),pointer=new T.Vector2();
const activeMeshes=[],animations=[];
const homeTarget=new T.Vector3(0,2.35,.1),homeCamera=new T.Vector3(9.6,9.1,15.6);
const host=()=>window.OpenAIGamesHost;
const $=s=>document.querySelector(s);
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function textTexture(text,w=1024,h=128,bg='#9b3945',fg='#f3dfb1',size=64,sub=''){
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=bg;x.fillRect(0,0,w,h);x.fillStyle=fg;x.font=`600 ${size}px "Avenir Next", "PingFang SC", sans-serif`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,w/2,sub?h*.34:h/2,w*.92);if(sub){x.font=`400 ${Math.round(size*.35)}px monospace`;x.fillText(sub,w/2,h*.76,w*.88);}const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
function applyLabel(object,name,text,options={}){const m=object.getObjectByName(name);if(!m)return;const map=textTexture(text,options.w||1024,options.h||128,options.bg||'#af965f',options.fg||'#5d2330',options.size||64,options.sub||'');m.material=new T.MeshBasicMaterial({map,toneMapped:false,transparent:false,side:T.FrontSide});m.material.map.flipY=true;}
function labelHardware(){
 applyLabel(tv,'tv_brand','OpenAIGames',{bg:'#b7b6a4',fg:'#303a31'});
 applyLabel(consoleMesh,'console_brand','OpenAIGames',{bg:'#923747',fg:'#f2ddab'});
 for(const name of ['power','restart'])applyLabel(consoleMesh,name+'_label',name==='power'?'POWER':'RESET',{bg:'#e7dfc6',fg:'#7a6852',size:44});
 applyLabel(pad,'controller_brand','OpenAIGames',{bg:'#b8a06b',fg:'#702736',size:58});
 for(const name of ['start','select'])applyLabel(pad,name+'_label',name.toUpperCase(),{bg:'#b8a06b',fg:'#5b4a2d',size:51});
 for(const [name,label] of [['back','B'],['action','A']])applyLabel(pad,name+'_label',label,{bg:'#222825',fg:'#cab986',w:128,h:128,size:88});
 applyLabel(manual,'manual_cover','怎么玩',{bg:'#e4d6b6',fg:'#8f3541',w:512,h:700,size:100,sub:'OpenAIGames'});
}
function addTargets(group){group.traverse(o=>{if(o.isMesh&&(o.userData.action||o.userData.direction||o.userData.card||o.userData.screen||o.userData.manual))activeMeshes.push(o);});}
function sceneCard(card,p){
 card.userData.project=p;card.traverse(o=>{if(o.isMesh){o.userData.card=p.id;o.castShadow=true;o.receiveShadow=true;}});
 const material=new T.MeshStandardMaterial({map:textTexture(p.title,768,768,'#27272b','#ebdbb6',60),roughness:.58,metalness:0});
 card.getObjectByName('cart_art').material=material;
 texLoader.load(p.cover_url,texture=>{if(!rackCards.includes(card)){texture.dispose();return;}texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;material.map.dispose();material.map=texture;material.needsUpdate=true;dirty=true;},undefined,()=>{});
 applyLabel(card,'cart_title',p.title,{w:768,h:96,bg:'#d2bd85',fg:'#303d2d',size:54});
 const i=[...p.id].reduce((sum,c)=>sum+c.charCodeAt(0),0)%6;
 const shell=card.getObjectByName('cart_shell');shell.material=shell.material.clone();shell.material.color.set(['#bca565','#aaa57d','#819e78','#aaa180','#8d869b','#8398a5'][i]);card.getObjectByName('cart_top_lip').material=shell.material;
}
function registerCart(card){addTargets(card);}
function refreshRack(){
 if(!cardSource||inserting||drag)return;
 const projects=host().state().projects.filter(p=>p.current_version&&p.featured).slice(0,6);
 const key=projects.map(p=>p.id+':'+p.title+':'+p.cover_url).join('|');if(key===rackKey)return;
 rackKey=key;hoverCard=null;hover=null;clearInspection();
 for(const c of rackCards){scene.remove(c);c.traverse(o=>{const i=activeMeshes.indexOf(o);if(i>=0)activeMeshes.splice(i,1);if(o.isMesh&&['cart_art','cart_title'].includes(o.name)){o.material.map?.dispose();o.material.dispose();}});}
 rackCards=projects.map((p,i)=>{const card=cardSource.clone(true);sceneCard(card,p);card.position.set(3.5+(i%2)*1.95,.13,1.5+Math.floor(i/2)*1.8);card.rotation.set(-.2,-.24,0);card.scale.setScalar(.93);card.userData.home=card.position.clone();card.userData.homeQ=card.quaternion.clone();scene.add(card);registerCart(card);return card;});dirty=true;
}
function clearInspection(){root.classList.remove('inspecting');if(!inspection)return;scene.remove(inspection);inspection.traverse(o=>{if(o.isMesh)o.material.dispose();});inspection=null;inspectionId=null;inspectionProgress=0;}
function setCardHover(card){
 if(hoverCard===card)return;hoverCard=card;
 if(card&&!inserting&&!focus){
  clearInspection();inspection=card.clone(true);inspectionId=card.userData.project.id;inspectionProgress=0;
  inspection.traverse(o=>{if(o.isMesh){o.userData={card:inspectionId,inspection:true};o.material=o.material.clone();o.material.transparent=true;o.material.opacity=0;o.castShadow=false;o.receiveShadow=false;}});scene.add(inspection);root.classList.add('inspecting');
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
  const mobile=innerWidth<700,desiredWidth=Math.min(265,innerWidth*(mobile?.55:.30));
  const size=desiredWidth*(2*halfHeight)/(innerHeight*1.63)*( .94+.06*inspectionProgress);
  inspection.position.copy(camera.position).addScaledVector(forward,distance).addScaledVector(right,(mobile?0:-.68)*halfHeight*camera.aspect).addScaledVector(up,(mobile?.55:.14)*halfHeight-.74*size-(1-inspectionProgress)*.18);
  inspection.quaternion.copy(camera.quaternion);inspection.scale.setScalar(size);inspection.traverse(o=>{if(o.isMesh)o.material.opacity=inspectionProgress;});
 }
 return moving;
}
function returnCard(card){
 card.userData.returning=true;card.userData.lift=0;const from=card.position.clone(),home=card.userData.home.clone(),q=card.quaternion.clone(),scale=card.scale.x,above=new T.Vector3(home.x,3,home.z);
 animations.push({start:performance.now(),duration:reduced?0:650,tick:t=>{const a=t<.6?t/.6:(t-.6)/.4,e=a*a*(3-2*a);card.position.lerpVectors(t<.6?from:above,t<.6?above:home,e);card.quaternion.slerpQuaternions(q,card.userData.homeQ,t);card.scale.setScalar(T.MathUtils.lerp(scale,.93,t));},end:()=>{card.userData.returning=false;}});dirty=true;
}
function fullscreen(){if(immersive){exitFullscreen();return;}fullPending=true;if(!focus||tween)cameraTo('screen');else enterFullscreen();}
function enterFullscreen(){
 fullPending=false;fullRect=screenObject.element.getBoundingClientRect();fullOriginalTransform=screenObject.element.style.transform;immersive=true;orbit.enabled=false;const el=screenObject.element;root.classList.add('immersive');el.style.transform='none';el.style.pointerEvents='auto';el.style.transformOrigin='0 0';
 fullscreenAnimation=el.animate([{transform:`translate(${fullRect.x}px,${fullRect.y}px) scale(${fullRect.width/innerWidth},${fullRect.height/innerHeight})`,borderRadius:'11px'},{transform:'none',borderRadius:'0px'}],{duration:reduced?0:650,easing:'cubic-bezier(.22,1,.36,1)'});
}
function exitFullscreen(){if(!immersive)return;fullscreenAnimation?.cancel();const el=screenObject.element;fullscreenAnimation=el.animate([{transform:'none',borderRadius:'0px'},{transform:`translate(${fullRect.x}px,${fullRect.y}px) scale(${fullRect.width/innerWidth},${fullRect.height/innerHeight})`,borderRadius:'11px'}],{duration:reduced?0:550,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});fullscreenAnimation.onfinish=()=>{fullscreenAnimation.cancel();immersive=false;root.classList.remove('immersive');el.style.transformOrigin='';el.style.transform=fullOriginalTransform;cssRenderer.render(scene,camera);dirty=true;};}
window.OpenAIGamesScene={fullscreen,exitFullscreen,isImmersive:()=>immersive,
 play:id=>{if(!booted||disposed)return false;if(inserting)return true;if(locateCard(id)){insert(id);}else{host().pick(id);host().start();cameraTo('screen');}return true;},
 browse:()=>{if(!booted||disposed)return;setCardHover(null);if(inserting){insertGeneration++;inserting=false;animations.length=0;if(liveCart){scene.remove(liveCart);liveCart=null;}rackCards.forEach(card=>{card.visible=true;card.position.copy(card.userData.home);card.quaternion.copy(card.userData.homeQ);card.userData.returning=false;});}cameraTo('overview');}
};
function locateCard(id){return rackCards.find(c=>c.userData.project.id===id);}
function hint(text){$('#scene-tip').textContent=text;}
function readSize(){const width=innerWidth,height=innerHeight;renderer.setSize(width,height);cssRenderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();if(!booted)return;const mobile=width<700;homeCamera.set(mobile?16:9.6,mobile?15.3:9.1,mobile?31.6:15.6);if(focus)cameraTo('screen');else if(!tween){camera.position.copy(homeCamera);orbit.target.copy(homeTarget);}dirty=true;}
function cameraTo(mode){if(immersive)exitFullscreen();setCardHover(null);focus=mode==='screen';const screenPos=new T.Vector3();screenObject.getWorldPosition(screenPos);const distance=Math.max(7.7,4.96/(2*Math.tan(T.MathUtils.degToRad(19))*camera.aspect*.89));const destination=focus?screenPos.clone().add(new T.Vector3(0,.08,distance)):homeCamera.clone();const target=focus?screenPos:homeTarget.clone();const fromSpherical=new T.Spherical().setFromVector3(camera.position.clone().sub(orbit.target)),toSpherical=new T.Spherical().setFromVector3(destination.clone().sub(target));toSpherical.theta=fromSpherical.theta+Math.atan2(Math.sin(toSpherical.theta-fromSpherical.theta),Math.cos(toSpherical.theta-fromSpherical.theta));tween={start:performance.now(),duration:reduced?0:1100,fromSpherical,toSpherical,fromTarget:orbit.target.clone(),toTarget:target};orbit.minDistance=focus?5.5:8.3;orbit.enabled=false;$('#view-screen').classList.toggle('active',focus);$('#view-overview').classList.toggle('active',!focus);root.classList.toggle('screen-view',focus);$('#three-controls').classList.toggle('show',focus&&latest?.route==='game');screenObject.element.style.pointerEvents=focus?'auto':'none';hint(focus?'直接操作屏幕。Esc 退卡，回到游戏机。':'拖动，转一转。点一张卡带，开始玩。');dirty=true;}
function pressMesh(m){if(!m)return;const y=m.position.y;animations.push({start:performance.now(),duration:170,tick:t=>{m.position.y=y-Math.sin(t*Math.PI)*.027;},end:()=>m.position.y=y});dirty=true;}
async function perform(m){try{if(!host()||!m)return;const d=m.userData;if(d.card){await insert(d.card);return;}if(d.screen){cameraTo('screen');return;}if(d.manual){host().action('manual');return;}if(d.direction){if(latest?.route==='game')host().bridge('keydown',d.direction);else host().move(['ArrowUp','ArrowLeft'].includes(d.direction)?-1:1);held=d.direction;pressMesh(m);return;}pressMesh(m);if(d.action==='action'){if(latest?.route==='game')host().bridge('action');else host().action('start');}else if(d.action==='eject'||d.action==='back'){host().action('eject');cameraTo('overview');}else{host().action(d.action);if(d.action==='start'&&latest?.power)cameraTo('screen');}}catch(error){host().toast(error.message);}}
async function insert(id){if(inserting)return;const original=locateCard(id);if(!original||original.userData.returning)return;inserting=true;const generation=++insertGeneration;setCardHover(null);host().pick(id);if(liveCart){scene.remove(liveCart);liveCart=null;}
 const cart=original.clone(true);cart.traverse(o=>{if(o.isMesh)o.userData={};});scene.add(cart);const pose=inspectionId===id&&inspection?inspection:original;cart.position.copy(pose.position);cart.quaternion.copy(pose.quaternion);cart.scale.copy(pose.scale);clearInspection();original.visible=false;const from=cart.position.clone(),fromQ=cart.quaternion.clone(),to=new T.Vector3(0,.77,2.0-.36),toQ=new T.Quaternion(),fromScale=cart.scale.x;liveCart=cart;hint('把这一张，装进游戏机。');let cameraStarted=false;
 const flightHeight=from.z<.6?8:Math.max(from.y,2.9),lifted=new T.Vector3(from.x,flightHeight,from.z),aboveSlot=new T.Vector3(0,flightHeight,1.64);
 animations.push({start:performance.now(),duration:reduced?0:1500,tick:t=>{
  const phase=t<.22?0:t<.7?1:2;
  const raw=phase===0?t/.22:phase===1?(t-.22)/.48:(t-.7)/.3,e=raw*raw*(3-2*raw);
  cart.position.lerpVectors(phase===0?from:phase===1?lifted:aboveSlot,phase===0?lifted:phase===1?aboveSlot:to,e);
  const turn=T.MathUtils.smoothstep(t,0,.66);cart.quaternion.slerpQuaternions(fromQ,toQ,turn);cart.scale.setScalar(T.MathUtils.lerp(fromScale,1,turn));
  if(t>.74&&!cameraStarted&&generation===insertGeneration){cameraStarted=true;cameraTo('screen');}
 },end:()=>{original.visible=true;original.position.copy(original.userData.home);original.quaternion.copy(original.userData.homeQ);original.scale.setScalar(.93);original.userData.lift=0;if(generation!==insertGeneration)return;inserting=false;if(host().state().power){host().start();hint('咔哒。点击游戏画面，开始玩。');}}});dirty=true;
}
function overSlot(e){const p=new T.Vector3(0,.91,1.64).project(camera);return Math.hypot(e.clientX-(p.x+1)*innerWidth/2,e.clientY-(1-p.y)*innerHeight/2)<Math.min(70,innerWidth*.085);}
function getHit(e){const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(scene.children,true).find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return h.object.isMesh;});if(!hit)return;const m=hit.object;return activeMeshes.includes(m)||m.userData.inspection?m:undefined;}
function sync(){if(!host()||!booted)return;const previous=latest;latest=host().state();if(previous&&previous.route!==latest.route&&!inserting&&!(focus&&latest.route==='game'))cameraTo(latest.route==='game'?'screen':'overview');$('#three-controls').classList.toggle('show',focus&&latest.route==='game');const led=tv.getObjectByName('power_light');led.material.emissiveIntensity=latest.power?1.7:0;led.material.color.set(latest.power?'#ed6140':'#55382b');
 if(!latest.power&&inserting){inserting=false;insertGeneration++;}
 if((latest.route!=='game'||!latest.power)&&liveCart&&!inserting){scene.remove(liveCart);liveCart=null;rackCards.forEach(c=>c.visible=true);}
 refreshRack();dirty=true;
}
async function init(){
 if(new URLSearchParams(location.search).get('view')==='flat')return;
 try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{return;}
 document.body.appendChild(root);root.querySelector('#three-canvas').appendChild(renderer.domElement);document.body.classList.add('is-3d');
 scene=new T.Scene();scene.background=new T.Color('#d8d8cd');scene.fog=new T.Fog('#d8d8cd',26,52);
 camera=new T.PerspectiveCamera(38,innerWidth/innerHeight,.1,100);camera.position.copy(homeCamera);
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.03;
 const pmrem=new T.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(new RoomEnvironment(),.035).texture;scene.environmentIntensity=.8;
 const key=new T.DirectionalLight('#fff0d2',3);key.position.set(-5,11,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-10;key.shadow.camera.right=10;key.shadow.camera.top=10;key.shadow.camera.bottom=-10;key.shadow.normalBias=.015;key.shadow.bias=-.0001;scene.add(key);
 const fill=new T.DirectionalLight('#cddaf3',1.5);fill.position.set(6,5,-4);scene.add(fill);scene.add(new T.HemisphereLight('#f1f0d7','#716355',1.5));
 const floor=new T.Mesh(new T.PlaneGeometry(160,160),new T.MeshStandardMaterial({color:'#bbb9a5',roughness:.88}));floor.rotation.x=-Math.PI/2;floor.position.y=-.035;floor.receiveShadow=true;scene.add(floor);
 orbit=new OrbitControls(camera,renderer.domElement);orbit.target.copy(homeTarget);orbit.enableDamping=true;orbit.dampingFactor=.09;orbit.minDistance=8.3;orbit.maxDistance=40;orbit.maxPolarAngle=Math.PI*.46;orbit.minPolarAngle=.18;orbit.enablePan=false;orbit.addEventListener('change',()=>dirty=true);
 cssRenderer=new CSS3DRenderer();root.querySelector('#three-html').appendChild(cssRenderer.domElement);cssRenderer.domElement.style.pointerEvents='none';
 const [tvData,bodyData,padData,cartData,bookData,art]=await Promise.all([loader.loadAsync('/static/models/television.glb'),loader.loadAsync('/static/models/console.glb'),loader.loadAsync('/static/models/controller.glb'),loader.loadAsync('/static/models/cartridge.glb'),loader.loadAsync('/static/models/manual.glb'),texLoader.loadAsync('/static/games/dodo/title.png')]);
 tv=tvData.scene.children[0];consoleMesh=bodyData.scene.children[0];pad=padData.scene.children[0];manual=bookData.scene.children[0];
 tv.position.set(0,1.8,-2.3);consoleMesh.position.set(0,0,2.0);pad.position.set(-3.2,0,2.75);pad.rotation.y=.18;manual.position.set(-4.6,0,-.15);manual.rotation.y=.28;
 for(const group of [tv,consoleMesh,pad,manual]){group.traverse(o=>{if(o.isMesh){o.castShadow=!o.name.includes('label');o.receiveShadow=true;}});scene.add(group);}
 const mask=tv.getObjectByName('screen_surface');mask.userData.screen=true;mask.castShadow=false;mask.receiveShadow=false;mask.material=new T.MeshBasicMaterial({color:0x000000,opacity:0,blending:T.NoBlending,depthWrite:true});manual.traverse(o=>{if(o.isMesh)o.userData.manual=true;});
 labelHardware();[tv,consoleMesh,pad,manual].forEach(addTargets);
 scene.add(cable([[-3.2,.29,2.1],[-3.65,.12,1.7],[-3.35,.09,.2],[-1.9,.065,.35],[-1.7,.15,1.2],[-1.37,.56,1.36]]));
 scene.add(cable([[.6,.5,.68],[1.4,.08,.3],[2.4,.06,-.9],[2.5,1.9,-2.7]]));
 const standMat=new T.MeshStandardMaterial({color:'#a5a497',roughness:.65});const standTop=new T.Mesh(new T.BoxGeometry(6.7,.17,2.8),standMat);standTop.position.set(0,1.72,-2.9);standTop.castShadow=true;standTop.receiveShadow=true;scene.add(standTop);for(const x of [-2.95,2.95]){const leg=new T.Mesh(new T.BoxGeometry(.14,1.67,2.3),standMat);leg.position.set(x,.8,-2.9);leg.castShadow=true;leg.receiveShadow=true;scene.add(leg);}
 const shelf=new T.Mesh(new T.BoxGeometry(4.1,.15,1.65),new T.MeshStandardMaterial({color:'#8f8266',roughness:.6}));shelf.position.set(4.45,.055,1.5);shelf.receiveShadow=true;scene.add(shelf);
 cardSource=cartData.scene.children[0];cardArt=art;refreshRack();
 const screen=document.getElementById('screen');screen.classList.add('three-screen');screen.style.width='640px';screen.style.height='445px';screen.style.pointerEvents='none';screenObject=new CSS3DObject(screen);screenObject.scale.setScalar(4.96/640);screenObject.position.set(-.2,4.41,-2.3+.854);scene.add(screenObject);
 renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(inserting)return;const m=getHit(e);down={x:e.clientX,y:e.clientY,mesh:m,time:performance.now()};if(m?.userData.direction){orbit.enabled=false;perform(m);}else if(m?.userData.card){orbit.enabled=false;const card=locateCard(m.userData.card);drag={card,home:card.userData.home.clone(),homeRotation:new T.Euler().setFromQuaternion(card.userData.homeQ),startX:e.clientX,startY:e.clientY,moved:false};renderer.domElement.setPointerCapture(e.pointerId);} });
 renderer.domElement.addEventListener('pointermove',e=>{if(drag){const distance=Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY);if(distance>8)drag.moved=true;if(drag.moved){getHit(e);const plane=new T.Plane(new T.Vector3(0,1,0),-3),point=new T.Vector3();if(raycaster.ray.intersectPlane(plane,point)){point.x=T.MathUtils.clamp(point.x,-2.5,6.2);point.z=T.MathUtils.clamp(point.z,.9,5.8);if(overSlot(e)){point.x=0;point.z=1.64;}drag.card.position.set(point.x,3,point.z);drag.card.rotation.set(0,0,0);drag.card.scale.setScalar(1);hint(point.distanceTo(new T.Vector3(0,3,1.64))<1.4?'松手，插入卡带。':'把卡带拖到主机的插槽上。');dirty=true;}}return;}const m=getHit(e);if(m!==hover){hover=m;setCardHover(m?.userData.card?locateCard(m.userData.card):null);renderer.domElement.style.cursor=m?'pointer':'grab';if(m?.userData.card)hint(locateCard(m.userData.card).userData.project.title+' · 点一下或拖入卡槽');else if(m?.userData.screen)hint('点击屏幕，坐近一点。');else if(m?.userData.manual)hint('翻开使用手册');else if(m?.userData.action)hint({power:'打开 / 关闭电源',eject:'退回卡带',restart:'重新开始',sound:'开关按键音',start:'开始 / 暂停',select:'切换 / 暂停',back:'返回',action:'A · 确认 / 动作'}[m.userData.action]||'按下按钮');else if(!focus)hint('拖动，转一转。点一张卡带，开始玩。');}});
 renderer.domElement.addEventListener('pointerleave',()=>{if(!drag){setCardHover(null);hover=null;}});
 const release=e=>{if(held){host().bridge('keyup',held);held=null;}if(drag){const d=drag;drag=null;const inSlot=overSlot(e)||d.card.position.distanceTo(new T.Vector3(0,3,1.64))<1.4;if(!d.moved||inSlot){insert(d.card.userData.project.id);}else{setCardHover(null);returnCard(d.card);hint('卡带放回盒子。点一下也能插卡。');}dirty=true;}else if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<7&&performance.now()-down.time<700&&!down.mesh?.userData.direction)perform(down.mesh);down=null;orbit.enabled=!focus&&!tween;};
 renderer.domElement.addEventListener('pointerup',release);renderer.domElement.addEventListener('pointercancel',()=>{if(drag){returnCard(drag.card);drag=null;}if(held){host().bridge('keyup',held);held=null;}down=null;orbit.enabled=!focus&&!tween;dirty=true;});
 document.getElementById('view-fullscreen').onclick=fullscreen;document.getElementById('exit-immersive').onclick=exitFullscreen;document.getElementById('view-overview').onclick=()=>cameraTo('overview');document.getElementById('view-screen').onclick=()=>cameraTo('screen');document.getElementById('scene-library').onclick=()=>{host().action('eject');cameraTo('screen');};document.getElementById('scene-flat').onclick=()=>{location.href=location.pathname+'?'+new URLSearchParams({...Object.fromEntries(new URLSearchParams(location.search)),view:'flat'})+location.hash;};
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&immersive&&!document.getElementById('dialog').open){e.preventDefault();e.stopImmediatePropagation();exitFullscreen();}},true);
 window.addEventListener('openaigames-state',sync);window.addEventListener('resize',readSize);window.addEventListener('keydown',e=>{if(document.body.classList.contains('site-open'))return;if(e.key==='Escape'&&!document.getElementById('dialog').open){cameraTo('overview');}});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();fallback('三维显示暂时不可用，已切换基础视图。');});
 booted=true;readSize();sync();root.querySelector('.three-loading').remove();
 if(host().state().route==='game')cameraTo('screen');
 function frame(){if(disposed)return;requestAnimationFrame(frame);let moving=false;const now=performance.now();if(!immersive)orbit.update();if(tween){const t=tween.duration?Math.min(1,(now-tween.start)/tween.duration):1,e=1-Math.pow(1-t,3);orbit.target.lerpVectors(tween.fromTarget,tween.toTarget,e);const spherical=new T.Spherical(T.MathUtils.lerp(tween.fromSpherical.radius,tween.toSpherical.radius,e),T.MathUtils.lerp(tween.fromSpherical.phi,tween.toSpherical.phi,e),T.MathUtils.lerp(tween.fromSpherical.theta,tween.toSpherical.theta,e));camera.position.setFromSpherical(spherical).add(orbit.target);camera.lookAt(orbit.target);if(t>=1){tween=null;orbit.enabled=!focus;if(fullPending){cssRenderer.render(scene,camera);enterFullscreen();}}moving=true;}
  for(let i=animations.length-1;i>=0;i--){const a=animations[i],t=a.duration?Math.min(1,(now-a.start)/a.duration):1;a.tick(t);if(t>=1){a.end?.();animations.splice(i,1);}moving=true;}
  const objectsMoving=animateCardHover()||animations.length>0;moving||=objectsMoving;if(objectsMoving)renderer.shadowMap.needsUpdate=true;if(dirty||moving){const screenWorld=new T.Vector3();screenObject.getWorldPosition(screenWorld);screenObject.element.style.visibility=camera.position.z>screenWorld.z+.3?'visible':'hidden';renderer.render(scene,camera);if(!immersive)cssRenderer.render(scene,camera);root.dataset.drawCalls=String(renderer.info.render.calls);dirty=false;}
 }
 frame();
 };
function fallback(message){disposed=true;const screen=document.getElementById('screen');if(screen&&root.contains(screen)){screen.classList.remove('three-screen');screen.style.cssText='';document.querySelector('.bezel').appendChild(screen);}root.remove();document.body.classList.remove('is-3d');renderer?.dispose();if(message&&host())host().toast(message);}
async function ready(){for(let i=0;i<100&&!host()?.state().projects.length;i++)await new Promise(r=>setTimeout(r,100));if(!host())return;try{await init();}catch(error){console.error('3D scene failed',error);fallback('三维资源暂未载入，仍可在基础视图开玩。');}}
ready();
