import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ROOM } from './camera-motion.mjs';

export function nightRoom({scene, texture, targets, invalidate}) {
  const blue=new T.MeshStandardMaterial({color:'#244fa9',roughness:.45,metalness:.3});
  const navy=new T.MeshStandardMaterial({color:'#0d1935',roughness:.68});
  const orange=new T.MeshStandardMaterial({color:'#e87532',roughness:.42,metalness:.12});
  const cyan=new T.MeshBasicMaterial({color:'#38aaff',toneMapped:false});
  const amber=new T.MeshBasicMaterial({color:'#ff8039',toneMapped:false});
  const metal=new T.MeshStandardMaterial({color:'#293a61',roughness:.3,metalness:.7});
  const boxes=[],signs=[],ready=[];
  const translate=text=>window.OpenAIGamesI18n?.t(text)||text;
  function box(name,w,h,d,x,y,z,material=navy,r=.04){
    const mesh=new T.Mesh((r===0?new T.BoxGeometry(w,h,d):new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3))),material);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);boxes.push(mesh);return mesh;
  }
  function sign(name,text,w,h,x,y,z,{bg='#0e1b35',fg='#b9e2ff',action,top=false,runs}={}){
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.name=name;mesh.position.set(x,y,z);if(top)mesh.rotation.x=-Math.PI/2;
    const entry={mesh,text,w,h,bg,fg,runs};signs.push(entry);paint(entry);
    if(action){mesh.userData.roomAction=action;targets.push(mesh);}scene.add(mesh);return mesh;
  }
  function paint(entry){entry.mesh.material.map?.dispose();entry.mesh.material.map=texture(entry.runs||translate(entry.text),Math.max(256,Math.min(2048,Math.round(entry.w/entry.h*256))),256,entry.bg,entry.fg,128);entry.mesh.material.needsUpdate=true;}
  function updateSign(name,text){const entry=signs.find(entry=>entry.mesh.name===name);if(entry){entry.text=text;paint(entry);}}
  window.addEventListener('openaigames-language',()=>{signs.forEach(paint);invalidate();});
  // One unit is 10 cm: 180 × 96 cm desktop, 75 cm above the floor.
  box('desk_surface',18,.25,9.6,0,-.17,.35,blue,.12);
  box('desk_front_apron',17.7,.35,.18,0,-.42,4.98,navy);
  box('desk_blue_edge',17.6,.035,.03,0,-.045,5.17,cyan,.01);
  for(const x of [-8.1,8.1]){box('desk_leg',.35,7.05,8.3,x,-3.86,.3,metal);box('desk_foot',1.3,.18,8.6,x,-7.39,.3,navy);}
  box('desk_mat',7.3,.025,5.2,-.3,-.025,1.75,new T.MeshStandardMaterial({color:'#132544',roughness:.96}));
  box('monitor_riser',6.7,.2,2.8,0,1.5,-2.9,blue);
  for(const x of [-2.95,2.95])box('monitor_riser_leg',.16,1.4,2.3,x,.7,-2.9,metal);

  // One desk-width bridge cabinet. Side cubbies sit behind desktop objects.
  box('cabinet_bridge',18,.5,1.8,0,7.05,-3.5,blue);
  box('cabinet_upper_back',18,1.65,.13,0,8.13,-4.34,navy);
  box('cabinet_top',18,.18,1.8,0,9,-3.5,blue);
  for(const x of [-8.92,8.92])box('cabinet_upper_end',.16,1.68,1.8,x,8.13,-3.5,blue);
  for(const x of [-5.04,-1.68,1.68,5.04])box('cabinet_upper_divider',.06,1.66,1.6,x,8.14,-3.5,metal);
  box('cabinet_downlight',17,.035,.09,0,6.78,-2.75,cyan,.01);
  for(const x of [-7.8,7.8]){
    box('cabinet_side_back',2.4,6.66,.13,x,3.41,-4.34,navy);
    for(const side of [-1.12,1.12])box('cabinet_side_post',.16,6.74,1.8,x+side,3.43,-3.5,blue);
    for(const y of [.14,2.34,4.54,6.73]){box('cabinet_cubby_shelf',2.4,.14,1.8,x,y,-3.5,blue);box('cabinet_cubby_light',2.15,.025,.035,x,y+.08,-2.585,cyan,.01);}
  }
  sign('catalog_name','游戏目录',4.6,.43,-1.15,7.08,-2.585,{action:'catalog',bg:'#244fa9'});
  sign('cabinet_search','找游戏',1.7,.43,4.47,7.08,-2.58,{action:'search',bg:'#e87532',fg:'#132748'});
  sign('cabinet_previous','‹',.48,.43,5.85,7.08,-2.58,{action:'previous',bg:'#244fa9'});
  sign('cabinet_page','1 / 1',.95,.35,6.66,7.08,-2.58,{bg:'#244fa9'});
  sign('cabinet_next','›',.48,.43,7.48,7.08,-2.58,{action:'next',bg:'#244fa9'});
  sign('category_left','',2.05,.38,-7.8,6.47,-2.57);
  sign('category_right','',2.05,.38,7.8,6.47,-2.57);
  // Six continuous interior faces. Camera travel uses these exact bounds as well.
  const roomWidth=ROOM.right-ROOM.left,roomHeight=ROOM.ceiling-ROOM.floor,roomDepth=ROOM.front-ROOM.back;
  const centerX=(ROOM.left+ROOM.right)/2,centerY=(ROOM.floor+ROOM.ceiling)/2,centerZ=(ROOM.back+ROOM.front)/2,wallThickness=.28;
  const sideWall=new T.MeshStandardMaterial({color:'#112653',roughness:.8});
  const floorMaterial=new T.MeshStandardMaterial({color:'#0a1324',roughness:.8,metalness:.12});
  box('wall_back',roomWidth+.56,roomHeight+.56,wallThickness,centerX,centerY,ROOM.back-.14,navy,0);
  box('wall_front',roomWidth+.56,roomHeight+.56,wallThickness,centerX,centerY,ROOM.front+.14,navy,0);
  box('wall_left',wallThickness,roomHeight+.56,roomDepth,ROOM.left-.14,centerY,centerZ,sideWall,0);
  box('wall_right',wallThickness,roomHeight+.56,roomDepth,ROOM.right+.14,centerY,centerZ,sideWall,0);
  box('ceiling',roomWidth+.56,wallThickness,roomDepth+.56,centerX,ROOM.ceiling+.14,centerZ,navy,0);
  box('floor',roomWidth+.56,wallThickness,roomDepth+.56,centerX,ROOM.floor-.14,centerZ,floorMaterial,0);
  for(let x=-11;x<18;x+=2.2)box('wall_panel_seam',.025,roomHeight,.04,x,centerY,ROOM.back+.025,metal,.008);
  function lightWash(x,y,radius,color){
    const material=new T.ShaderMaterial({uniforms:{tint:{value:new T.Color(color)}},vertexShader:'varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 tint;varying vec2 p;void main(){float a=pow(max(0.,1.-length(p-.5)*2.),2.)*.35;gl_FragColor=vec4(tint,a);}',transparent:true,depthWrite:false,blending:T.AdditiveBlending});
    const glow=new T.Mesh(new T.PlaneGeometry(radius*2,radius*2),material);glow.position.set(x,y,-5.8);scene.add(glow);
  }
  lightWash(-6,4,7,'#006cff');lightWash(8,4,6,'#ff5415');
  const loader=new T.TextureLoader();
  ready.push(loader.loadAsync('/static/brand/logo.jpg').then(map=>{
    map.colorSpace=T.SRGBColorSpace;
    const logo=new T.Mesh(new T.CircleGeometry(1.6,72),new T.MeshBasicMaterial({map}));logo.position.set(-11.66,6,1.8);logo.rotation.y=Math.PI/2;logo.userData.roomAction='github';targets.push(logo);scene.add(logo);
    const halo=new T.Mesh(new T.TorusGeometry(1.66,.035,8,80),cyan);halo.position.copy(logo.position);halo.position.x-=.02;halo.rotation.y=Math.PI/2;scene.add(halo);invalidate();
  }).catch(()=>{}));
  const badgeMaterial=new T.MeshBasicMaterial({color:'#102348'});
  box('wall_badge_frame',.14,1.48,4.6,ROOM.left+.13,3.55,1.8,blue,.04);
  box('wall_badge_face',.07,1.28,4.4,ROOM.left+.22,3.55,1.8,badgeMaterial,.025);
  const badgeHit=box('wall_badge_hit',.035,1.48,4.6,ROOM.left+.285,3.55,1.8,new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),0);
  badgeHit.userData.roomAction='github';targets.push(badgeHit);
  const wordmark=sign('wall_wordmark','OpenAIGames',4.1,.59,ROOM.left+.27,3.85,1.8,{bg:'#102348',action:'github',runs:[{text:'OpenAI',color:'#b7d9ff'},{text:'Games',color:'#ff903f'}]});wordmark.rotation.y=Math.PI/2;
  const githubLabel=sign('wall_github','组织 GitHub ↗',3.6,.46,ROOM.left+.27,3.23,1.8,{bg:'#102348',fg:'#b7d9ff',action:'github'});githubLabel.rotation.y=Math.PI/2;
  // A small shared work corner beside the organization badge.
  box('wall_pinboard_frame',.16,2.9,4.25,ROOM.left+.12,5.45,7,blue,.07);
  box('wall_pinboard',.055,2.65,4,ROOM.left+.22,5.45,7,navy,.04);
  const wallSign=(name,text,w,h,y,z,options={})=>{
    const mesh=sign(name,text,w,h,ROOM.left+.275,y,z,options);mesh.rotation.y=Math.PI/2;return mesh;
  };
  wallSign('wall_create_title','共创角',3.5,.4,6.47,7,{action:'community',bg:'#0d1935',fg:'#b7d9ff'});
  const gameNote=box('wall_note_game',.025,1.35,1.55,ROOM.left+.29,5.35,6,orange,.025);
  wallSign('wall_note_game_title','一起做游戏',1.42,.32,5.56,6,{action:'community',bg:'#e87532',fg:'#112653'}).position.x+=.035;
  wallSign('wall_note_game_sub','从一个 Demo 开始',1.4,.23,5.12,6,{action:'community',bg:'#e87532',fg:'#112653'}).position.x+=.035;
  const ideaNote=box('wall_note_idea',.025,1.35,1.55,ROOM.left+.29,5.35,8,blue,.025);
  wallSign('wall_note_idea_title','留个点子',1.35,.34,5.55,8,{action:'board',bg:'#244fa9',fg:'#d9e9ff'}).position.x+=.035;
  wallSign('wall_note_idea_sub','下一张卡带？',1.35,.25,5.1,8,{action:'board',bg:'#244fa9',fg:'#d9e9ff'}).position.x+=.035;
  gameNote.userData.roomAction='community';ideaNote.userData.roomAction='board';targets.push(gameNote,ideaNote);
  for(const z of [6,8])box('wall_note_pin',.06,.075,.075,ROOM.left+.36,5.96,z,metal,.018);
  box('wall_accessory_shelf',.8,.14,4.35,ROOM.left+.42,3.82,7,blue,.04);
  for(const [y,z,size,material] of [[8.25,.45,.32,orange],[8.8,.9,.24,blue],[8.6,1.4,.17,orange]])box('wall_pixel',.05,size,size,ROOM.left+.065,y,z,material,.015);
  // Keep the character in the gap between the screen and left cabinet.
  const stand=box('character_stand',2.35,4.0,.13,-4.95,2.06,-2.1,orange,.09);stand.rotation.y=.13;
  ready.push(loader.loadAsync('/static/brand/character.png').then(map=>{
    map.colorSpace=T.SRGBColorSpace;map.repeat.set(.54,1);map.offset.set(0,0);
    const art=new T.Mesh(new T.PlaneGeometry(2.2,3.82),new T.MeshBasicMaterial({map}));art.position.copy(stand.position);art.position.z+=.085;art.rotation.y=.13;scene.add(art);invalidate();
  }).catch(()=>{}));
  box('character_stand_foot',2.5,.13,1.0,-4.95,.015,-2.0,blue);
  const tray=box('submission_tray',2.05,1.55,1.3,7.8,1.0,-3.4,orange,.08);
  tray.userData.roomAction='submit';targets.push(tray);
  sign('submission_tray_label','快捷投稿',1.88,.6,7.8,1.13,-2.74,{action:'submit',bg:'#e87532',fg:'#112442'});
  box('submission_slot',1.28,.06,.025,7.8,.57,-2.735,navy,.01);
  box('keyboard_body',3.4,.12,1.05,-.9,.15,3.8,blue,.1);
  for(let row=0;row<4;row++)for(let col=0;col<12;col++)box('keycap',.215,.06,.175,-2.28+col*.255,.255,3.43+row*.21,(col+row)%9===0?orange:metal,.018);
  box('keyboard_space',1.2,.07,.16,-.9,.26,4.23,orange,.025);
  const mouse=box('mouse',.55,.25,.8,1.15,.15,3.8,orange,.18);mouse.rotation.y=-.13;
  box('mouse_strip',.028,.018,.37,1.15,.28,3.7,cyan,.004);
  sign('desk_favorites','精选 / 最近玩过',4.6,.34,4.4,-.15,5.185,{bg:'#244fa9',fg:'#ffd1a7'});
  const radio=box('room_radio',2.05,1.45,.72,5.25,.76,-2.6,orange,.1);radio.userData.roomAction='music';targets.push(radio);
  sign('radio_label','音乐',1.05,.36,5.53,.84,-2.225,{action:'music',bg:'#132744',fg:'#ffc38c'});
  for(let i=0;i<6;i++)box('radio_grille',.03,.85,.02,4.48+i*.085,.78,-2.225,navy,.006);
  const radioLed=sign('radio_led','●',.16,.15,6.0,1.21,-2.22,{action:'music',bg:'#e87532',fg:'#d1e0f7'});
  window.addEventListener('openaigames-music',event=>{const entry=signs.find(s=>s.mesh===radioLed);if(entry){const color=event.detail.playing?'#ffe4a8':'#31517d';if(entry.fg!==color){entry.fg=color;paint(entry);invalidate();}}});

  // Adult chair: 50 cm seat, 46 cm seat height, 122 cm headrest height.
  // It is pulled back and slightly left, facing the keyboard without covering it.
  const chairX=-.4,chairZ=10.5,chairMeshes=[];
  function chairBox(name,w,h,d,x,y,z,material=blue,r=.1){const mesh=box(name,w,h,d,x,y,z,material,r);chairMeshes.push(mesh);return mesh;}
  chairBox('chair_seat',5,.4,4.55,chairX,-3.24,chairZ-.5,blue,.2);
  chairBox('chair_seat_pad',4.15,.18,3.9,chairX,-2.99,chairZ-.55,navy,.16);
  for(const x of [-2.28,2.28])chairBox('chair_seat_piping',.12,.1,4.25,chairX+x,-2.98,chairZ-.5,orange);
  const back=chairBox('chair_back',4.65,6.6,.55,chairX,.2,chairZ+1.7,blue,.25);back.rotation.x=-.09;
  const cushion=chairBox('chair_back_cushion',3.6,5.7,.18,chairX,.2,chairZ+1.34,navy,.2);cushion.rotation.x=-.09;
  for(const x of [-1.98,1.98]){const bolster=chairBox('chair_side_bolster',.4,5.8,.65,chairX+x,.25,chairZ+1.6,orange,.14);bolster.rotation.x=-.09;}
  chairBox('chair_headrest',2.7,1.25,.65,chairX,4.08,chairZ+2.05,blue,.24);
  chairBox('chair_headrest_badge',1.55,.42,.025,chairX,4.08,chairZ+2.39,orange);
  for(const x of [-2.9,2.9]){chairBox('chair_arm_support',.18,2.1,.2,chairX+x,-2.2,chairZ-.45,metal);chairBox('chair_armrest',.48,.25,2.4,chairX+x,-1.08,chairZ-.7,navy,.14);}
  chairBox('chair_underseat',1.2,.48,1.25,chairX,-3.65,chairZ-.35,metal);
  const pole=new T.Mesh(new T.CylinderGeometry(.19,.24,3.35,20),metal);pole.position.set(chairX,-5.43,chairZ-.35);scene.add(pole);chairMeshes.push(pole);
  for(let i=0;i<5;i++){
    const angle=i*Math.PI*2/5;
    const spoke=chairBox('chair_base_spoke',.27,.19,2.9,chairX+Math.sin(angle)*1.43,-6.94,chairZ-.35+Math.cos(angle)*1.43,metal);spoke.rotation.y=angle;
    const wheel=new T.Mesh(new T.CylinderGeometry(.28,.28,.35,16),navy);wheel.rotation.z=Math.PI/2;wheel.position.set(chairX+Math.sin(angle)*2.87,ROOM.floor+.28,chairZ-.35+Math.cos(angle)*2.87);scene.add(wheel);chairMeshes.push(wheel);
  }
  const chairPivot=new T.Vector3(chairX,0,chairZ),chairTurn=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),-.24);
  for(const mesh of chairMeshes){mesh.position.sub(chairPivot).applyQuaternion(chairTurn).add(chairPivot);mesh.quaternion.premultiply(chairTurn);}
  const glow=new T.PointLight('#ff813a',30,12,2);glow.position.set(-3.6,3,-1.4);scene.add(glow);
  const rim=new T.PointLight('#087fff',75,25,2);rim.position.set(-7,7,1);scene.add(rim);
  const warm=new T.PointLight('#ff702a',60,22,2);warm.position.set(7.5,5,3);scene.add(warm);
  const batches=new Map();
  for(const mesh of boxes){if(targets.includes(mesh))continue;mesh.updateMatrix();const geometry=(mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone()).applyMatrix4(mesh.matrix);if(!batches.has(mesh.material))batches.set(mesh.material,[]);batches.get(mesh.material).push(geometry);scene.remove(mesh);mesh.geometry.dispose();}
  for(const [material,geometries] of batches){const mesh=new T.Mesh(mergeGeometries(geometries,false),material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='room_furniture_'+scene.children.length;scene.add(mesh);geometries.forEach(g=>g.dispose());}
  return {
    ready:Promise.all(ready),
    cabinetPosition:(side,index)=>new T.Vector3((side===0?-8.53:7.07)+(index%4)*.485,index<4?4.64:2.44,-3.45),
    upperPosition:index=>new T.Vector3(-7.65+index*1.68,7.34,-3.25),
    deskPosition:index=>new T.Vector3(3.4+index*1.75,.02,1.45),
    updateCabinet:layout=>{updateSign('category_left',layout.shelves[0]?.label||'');updateSign('category_right',layout.shelves[1]?.label||'');updateSign('cabinet_page',`${layout.page+1} / ${layout.pages}`);
      for(const name of ['cabinet_previous','cabinet_page','cabinet_next']){
        const mesh=signs.find(entry=>entry.mesh.name===name).mesh;mesh.visible=layout.pages>1;
        const i=targets.indexOf(mesh);if(layout.pages===1&&i>=0)targets.splice(i,1);else if(layout.pages>1&&i<0&&mesh.userData.roomAction)targets.push(mesh);
      }
    },
    actions:[['github','GitHub · 新标签打开'],['catalog','游戏目录'],['search','搜索游戏'],['previous','上一柜'],['next','下一柜'],['music','音乐'],['submit','快捷投稿'],['community','如何共创'],['board','许愿 / 留言']]
  };
}
