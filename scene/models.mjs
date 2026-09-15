import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
const material=(color,roughness=.42,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
export const M={ivory:material('#c5dcfa',.32),red:material('#ed783b',.29),edge:material('#102649',.45),black:material('#101d35',.48),rubber:material('#0b1326',.8),gold:material('#2d59b8',.36,.64),steel:material('#91b5dd',.3,.7),tv:material('#335cb7',.48),tvDark:material('#193265',.6),glass:new T.MeshPhysicalMaterial({color:'#071526',roughness:.16,metalness:.1,clearcoat:1,clearcoatRoughness:.14}),label:material('#cee6ff',.7),paper:material('#92b5db',.9)};
function mesh(g,geo,mat,name,x=0,y=0,z=0){const m=new T.Mesh(geo,mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
function box(g,name,w,h,d,x,y,z,mat=M.ivory,r=.035){return mesh(g,new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)),mat,name,x,y,z);}
function cyl(g,name,r,h,x,y,z,mat=M.black,n=24){return mesh(g,new T.CylinderGeometry(r,r,h,n),mat,name,x,y,z);}
function screw(g,x,y,z,side='top'){const m=cyl(g,'screw',.035,.018,x,y,z,M.steel,12);if(side==='front')m.rotation.x=Math.PI/2;const slot=box(g,'screw_slot',.045,.005,.008,x,y+.011,z,M.black,.001);if(side==='front'){slot.position.set(x,y,z+.011);slot.rotation.x=Math.PI/2;}return m;}
function decal(g,name,w,h,x,y,z,top=false){const m=mesh(g,new T.PlaneGeometry(w,h),M.label,name,x,y,z);m.castShadow=false;m.receiveShadow=false;if(top)m.rotation.x=-Math.PI/2;return m;}
export function television(){const g=new T.Group();g.name='television';
 box(g,'tv_rear_housing',6.28,4.65,2.25,0,2.5,-.7,M.tv,.23);
 box(g,'tv_rear_cover',5.85,4.15,.35,0,2.52,-1.92,M.tvDark,.16);
 // Four independent bezel rails leave a real opening for the interactive display.
 box(g,'tv_bezel_top',6.5,.44,.49,0,4.69,.57,M.tv,.13);
 box(g,'tv_bezel_bottom',6.5,.64,.55,0,.34,.57,M.tv,.11);
 box(g,'tv_bezel_left',.48,4.3,.55,-3.01,2.53,.57,M.tv,.12);
 box(g,'tv_bezel_controls',.95,4.3,.55,2.78,2.53,.57,M.tv,.12);
 const bx=-.245;
 box(g,'screen_recess_top',5.68,.19,.26,bx,4.45,.77,M.black,.08);
 box(g,'screen_recess_bottom',5.68,.2,.28,bx,.77,.77,M.black,.07);
 box(g,'screen_recess_left',.19,3.62,.28,-2.99+ .24,2.61,.78,M.black,.07);
 box(g,'screen_recess_right',.2,3.62,.28,2.37,2.61,.78,M.black,.07);
 const screen=mesh(g,new T.PlaneGeometry(4.98,3.47,32,24),M.glass,'screen_surface',-.2,2.61,.82);screen.castShadow=false;
 for(let i=0;i<15;i++)box(g,'speaker_slot',.54,.032,.08,2.77,1.1+i*.125,.885,M.black,.015);
 const knob=cyl(g,'sound',.29,.17,2.77,3.76,.98,M.black,40);knob.rotation.x=Math.PI/2;knob.userData.action='sound';
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2;const ridge=box(g,'dial_ridge',.016,.028,.13,2.77+Math.sin(a)*.28,3.76+Math.cos(a)*.28,.99,M.tvDark,.003);ridge.rotation.z=-a;ridge.userData.action='sound';}
 box(g,'dial_indicator',.027,.16,.017,2.77,3.84,1.077,M.label,.003).userData.action='sound';
 decal(g,'tv_brand',1.65,.2,-1.97,.35,.861);
 const led=box(g,'power_light',.065,.035,.025,-2.78,.29,.88,new T.MeshStandardMaterial({color:'#ea5839',emissive:'#e54d2e',emissiveIntensity:1.7}),.01);led.castShadow=false;
 for(const x of [-2.2,2.2])box(g,'tv_foot',.76,.25,1.38,x,.075,-.55,M.black,.05);
 for(let i=0;i<19;i++){box(g,'top_vent',.065,.017,1.05,-1.5+i*.155,4.835,-.79,M.black,.006);box(g,'rear_vent',.065,.76,.02,-1.5+i*.155,3.22,-2.105,M.black,.005);}
 for(const x of [-2.66,2.66])for(const y of [.75,4.2])screw(g,x,y,-2.115,'front');
 g.userData.screen={x:-.2,y:2.61,z:.854,width:4.96,height:3.45};return g;}
export function consoleModel(){const g=new T.Group();g.name='console';
 box(g,'bottom_case',3.2,.27,2.59,0,.27,0,M.red,.105);
 box(g,'case_seam',3.13,.032,2.51,0,.42,0,M.edge,.05);
 box(g,'upper_case',3.1,.41,2.46,0,.64,-.015,M.ivory,.08);
 box(g,'front_slope',2.75,.16,.4,0,.61,1.12,M.ivory,.06);
 for(const x of [-1.47,1.47]){box(g,'side_red_rail',.2,.35,1.94,x,.84,-.26,M.red,.045);box(g,'side_rail_groove',.03,.025,1.57,x,.99,-.31,M.edge,.008);}
 box(g,'slot_recess',2.17,.045,.45,0,.86,-.36,M.edge,.045);
 box(g,'slot_inner',1.78,.08,.19,0,.858,-.36,M.black,.02);
 for(const z of [-.58,-.135])box(g,'slot_rim',2.25,.095,.06,0,.894,z,M.red,.018);
 for(const x of [-1.105,1.105])box(g,'slot_side_rim',.055,.09,.43,x,.894,-.36,M.red,.014);
 for(let i=0;i<13;i++)box(g,'rear_cooling_slit',.062,.017,.39,-.72+i*.12,.852,-.93,M.tvDark,.012);
 box(g,'eject_channel',.42,.025,.6,0,.858,.36,M.tvDark,.025);
 box(g,'eject_rail',.027,.028,.45,0,.88,.29,M.steel,.002);
 const eject=box(g,'eject',.43,.14,.28,0,.954,.49,M.red,.03);eject.userData.action='eject';
 for(const [name,x] of [['power',-.91],['restart',.91]]){box(g,name+'_well',.43,.026,.38,x,.854,.47,M.tvDark,.022);const b=box(g,name,.31,.07,.27,x,.907,.47,M.red,.02);b.userData.action=name;box(g,name+'_line',.017,.006,.13,x,.947,.47,M.label,.002).userData.action=name;decal(g,name+'_label',.5,.095,x,.85,.81,true);}
 decal(g,'console_brand',1.98,.18,0,.73,1.265);
 box(g,'expansion_port',.51,.13,.1,0,.37,1.31,M.red,.026);
 for(const x of [-1.18,1.18])for(const z of [-.95,.95]){cyl(g,'rubber_foot',.11,.1,x,.092,z,M.rubber,16);screw(g,x,.43,z);}
 for(let i=0;i<6;i++)box(g,'side_cooling_slit',.015,.035,.51,-1.558,.55+i*.035,-.1,M.edge,.006);
 for(const x of [-.56,.56]){const c=cyl(g,'rear_socket',.075,.04,x,.44,-1.318,M.black,16);c.rotation.x=Math.PI/2;}
 g.userData.slot={x:0,y:1.13,z:-.36};return g;}
export function controller(){const g=new T.Group();g.name='controller';
 box(g,'pad_lower',3.15,.16,1.33,0,.2,0,M.edge,.08);box(g,'pad_shell',3.22,.23,1.34,0,.335,0,M.red,.095);
 box(g,'pad_inlay',2.99,.025,1.08,0,.46,0,M.gold,.045);
 for(const x of [-1.4,1.4])for(const z of [-.43,.43])screw(g,x,.48,z);
 // Connected cruciform well, with individually clickable direction pieces.
 box(g,'dpad_well_a',.76,.035,.28,-.99,.484,.08,M.edge,.025);box(g,'dpad_well_b',.28,.035,.76,-.99,.484,.08,M.edge,.025);
 box(g,'dpad_horizontal',.68,.082,.225,-.99,.526,.08,M.black,.018);box(g,'dpad_vertical',.225,.083,.68,-.99,.527,.08,M.black,.018);
 cyl(g,'dpad_center',.087,.009,-.99,.572,.08,M.rubber,16);
 for(const [name,x,z] of [['left',-1.24,.08],['right',-.74,.08],['up',-.99,-.17],['down',-.99,.33]]){const key=box(g,name,.2,.022,.2,x,.575,z,M.black,.012);key.userData.direction={left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown'}[name];}
 for(const [name,x] of [['select',-.22],['start',.2]]){box(g,name+'_well',.32,.015,.135,x,.48,.25,M.tvDark,.04);const key=box(g,name,.27,.065,.1,x,.515,.25,M.black,.035);key.userData.action=name;decal(g,name+'_label',.35,.07,x,.485,.43,true);}
 for(const [name,x,z] of [['back',.78,.17],['action',1.21,-.03]]){cyl(g,name+'_collar',.192,.033,x,.493,z,M.edge,32);const key=cyl(g,name,.164,.08,x,.54,z,M.black,32);key.userData.action=name;decal(g,name+'_label',.14,.14,x,.582,z,true).userData.action=name;}
 decal(g,'controller_brand',1.23,.19,.03,.485,-.28,true);
 for(let i=0;i<5;i++)box(g,'pad_back_ridge',1.25,.014,.025,0,.455,-.52+i*.035,M.red,.003);
 return g;}
export function cartridge(){const g=new T.Group();g.name='cartridge';
 box(g,'cart_shell',1.57,1.31,.28,0,.72,0,M.gold,.052);box(g,'cart_seam',1.58,.023,.284,0,.33,0,M.edge,.005);
 box(g,'cart_top_lip',1.63,.11,.32,0,1.385,0,M.gold,.024);
 box(g,'cart_bottom',1.32,.24,.23,0,.122,0,M.black,.015);
 box(g,'cart_contact',1.07,.095,.016,0,.12,.124,M.gold,.002);
 for(let i=0;i<18;i++)box(g,'cart_pin',.012,.084,.008,-.47+i*.055,.12,.137,M.steel,.001);
 box(g,'cart_label_inset',1.36,.96,.025,0,.86,.148,M.edge,.025);
 decal(g,'cart_art',1.27,.77,0,.91,.165);
 decal(g,'cart_title',1.27,.12,0,.466,.166);
 for(const x of [-.726,.726])for(let i=0;i<7;i++)box(g,'cart_grip',.035,.037,.021,x,.57+i*.075,.15,M.edge,.005);
 screw(g,0,1.253,-.158,'front');return g;}
export function cable(points,r=.033){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const m=new T.Mesh(new T.TubeGeometry(curve,64,r,8,false),M.rubber);m.name='cable';m.castShadow=true;return m;}
export function brochure(){const g=new T.Group();g.name='manual';box(g,'pages',1.4,.055,1.87,0,.06,0,M.paper,.01);box(g,'cover',1.45,.016,1.93,0,.098,0,M.label,.013);decal(g,'manual_cover',1.38,1.86,0,.109,0,true);for(let i=0;i<3;i++)box(g,'paper_edges',1.35,.003,1.86,.017,.054+i*.012,.01,M.tvDark,.001);return g;}
