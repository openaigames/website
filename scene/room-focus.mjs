import {Box3, Vector3} from 'three';
import {ROOM, containCamera, cameraPath, cameraPose} from './camera-motion.mjs';

const box=(min,max)=>new Box3(new Vector3(...min),new Vector3(...max));
const regions=[
  ['screen',box([-3.5,1.5,-4.2],[3.5,6.9,-.9])],
  ['cabinet',box([-9,6.8,-4.5],[9,9.25,-2.5])],
  ['cabinet',box([-9,0,-4.5],[-6.5,6.8,-2.5])],
  ['cabinet',box([6.5,0,-4.5],[9,6.8,-2.5])],
  ['desk',box([-9,-.6,-4.5],[9,.8,5.3])],
  ['wall',box([ROOM.left,-1,-1],[ROOM.left+.1,11,14])],
];

export function focusAreaForRay(ray){
  let area=null,distance=Infinity;
  for(const [name,bounds] of regions){
    const point=ray.intersectBox(bounds,new Vector3());
    if(point&&point.distanceTo(ray.origin)<distance){area=name;distance=point.distanceTo(ray.origin);}
  }
  return area;
}

export function cabinetDetailForRay(ray){
  let nearest=null,distance=Infinity;
  for(const [name,bounds] of regions){
    if(name!=='cabinet')continue;
    const point=ray.intersectBox(bounds,new Vector3());
    if(point&&point.distanceTo(ray.origin)<distance){nearest=point;distance=point.distanceTo(ray.origin);}
  }
  if(!nearest)return null;
  nearest.x=Math.max(-7.5,Math.min(7.5,nearest.x));
  nearest.y=Math.max(1.3,Math.min(8,nearest.y));nearest.z=-3.2;
  return nearest;
}

// Shift only the close-up endpoint so zooming out still returns through the
// original cabinet overview. Dragging follows the row, not the room's orbit.
export function panCabinetPath(path,progress,detail,dx,height,fov){
  const pose=cameraPose(path,progress),origin=cameraPose(path,0),destination=cameraPose(path,1);
  const span=2*pose.position.distanceTo(pose.target)*Math.tan(fov*Math.PI/360);
  const next=detail.clone();
  next.x=Math.max(-7.5,Math.min(7.5,detail.x-dx/Math.max(1,height)*span/Math.max(.1,progress)));
  const shift=next.x-detail.x;
  destination.target.x+=shift;destination.position.x+=shift;
  return {detail:next,path:cameraPath(origin.position,origin.target,destination.position,destination.target)};
}

// Preserve the room's horizontal framing in portrait without backing through a wall.
export function roomFov(aspect){return 2*Math.atan(Math.tan(19*Math.PI/180)*Math.max(1,.95/aspect))*180/Math.PI;}

export function focusDestination(area,aspect,screen,detail=null,fov=38){
  const halfFov=Math.tan(fov*Math.PI/360);
  let target,position;
  if(area==='cabinet'&&detail){
    target=detail.clone();
    position=target.clone().add(new Vector3(0,.6,Math.max(7.5,6/(2*halfFov*aspect*.9))));
  }else if(area==='screen'){
    target=screen.clone();
    position=target.clone().add(new Vector3(0,.08,Math.max(7.7,4.96/(2*halfFov*aspect*.89))));
  }else{
    const views={
      cabinet:{target:[0,5.3,-3.2],position:[2.2,7.8,24]},
      desk:{target:[0,.3,1.8],position:[3.5,11.6,16.3]},
      wall:{target:[ROOM.left+.13,4.55,4.6],position:[1.7,4.9,5.1]},
    };
    const view=views[area]||views.desk;
    target=new Vector3(...view.target);position=new Vector3(...view.position);
    position.sub(target).multiplyScalar(Math.max(1,Math.max(1,.95/aspect)*Math.tan(19*Math.PI/180)/halfFov)).add(target);
  }
  containCamera(position,target);return {position,target};
}

export function canScrollList({scrollHeight,clientHeight,scrollTop},delta){
  return scrollHeight>clientHeight+1 && (delta<0?scrollTop>1:scrollTop+clientHeight<scrollHeight-1);
}

// A direction reversal starts from the visible position, without paying off
// the previous gesture's still-pending movement first.
export function wheelGoal(progress,goal,delta){
  const base=delta>0?Math.min(progress,goal):Math.max(progress,goal);
  const next=Math.max(0,Math.min(1,base-delta/(delta>0?360:420)));
  return next<.015?0:next>.985?1:next;
}

export function resizeFocusPath(path,area,aspect,screen,detail=null,fov=38){
  const origin=cameraPose(path,0),destination=focusDestination(area,aspect,screen,detail,fov);
  return cameraPath(origin.position,origin.target,destination.position,destination.target);
}
