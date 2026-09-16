import {Vector3} from 'three';
import {ROOM,CAMERA_CLEARANCE} from './camera-motion.mjs';

// Move in the camera's screen plane, preserving its direction and distance.
// Clamp the translation itself so reaching a wall cannot tilt or zoom the view.
export function panRoomPose(position,target,dx,dy,height,fov){
 const forward=target.clone().sub(position).normalize();
 const right=new Vector3().crossVectors(forward,new Vector3(0,1,0)).normalize();
 const up=new Vector3().crossVectors(right,forward).normalize();
 const scale=2*position.distanceTo(target)*Math.tan(fov*Math.PI/360)/Math.max(1,height);
 const shift=right.multiplyScalar(-dx*scale).addScaledVector(up,dy*scale);
 for(const [axis,low,high] of [['x',ROOM.left,ROOM.right],['y',ROOM.floor,ROOM.ceiling],['z',ROOM.back,ROOM.front]]){
  shift[axis]=Math.max(low+CAMERA_CLEARANCE-Math.min(position[axis],target[axis]),Math.min(high-CAMERA_CLEARANCE-Math.max(position[axis],target[axis]),shift[axis]));
 }
 return {position:position.clone().add(shift),target:target.clone().add(shift)};
}
