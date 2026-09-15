import { MathUtils, Spherical, Vector3 } from 'three';

// Interior faces. Rendering and camera constraints share the same room dimensions.
export const ROOM = Object.freeze({ left: -11.675, right: 18, floor: -7.5, ceiling: 20, back: -5.86, front: 40 });
export const CAMERA_CLEARANCE = .7;

const ORBIT_LIMITS = Object.freeze({minDistance:8.3,maxDistance:44,minAzimuthAngle:-.5,maxAzimuthAngle:.9,minPolarAngle:.18,maxPolarAngle:Math.PI*.46});

// A scripted close-up can sit outside the overview's orbit angles. Adopt its
// visible pose before returning control, so the first click/drag cannot clamp it.
export function syncOrbitPose(controls) {
  const camera=controls.object,position=camera.position.clone(),target=controls.target.clone(),rotation=camera.quaternion.clone();
  const spherical=new Spherical().setFromVector3(position.clone().sub(target));
  for(const [min,max,value] of [['minDistance','maxDistance',spherical.radius],['minAzimuthAngle','maxAzimuthAngle',spherical.theta],['minPolarAngle','maxPolarAngle',spherical.phi]]){
    controls[min]=Math.min(ORBIT_LIMITS[min],value-1e-6);
    controls[max]=Math.max(ORBIT_LIMITS[max],value+1e-6);
  }
  const damping=controls.enableDamping;
  controls.enableDamping=false;controls.update();controls.enableDamping=damping;
  camera.position.copy(position);controls.target.copy(target);camera.quaternion.copy(rotation);
}

export function containCamera(position, target, clearance = CAMERA_CLEARANCE) {
  const offset = position.clone().sub(target);
  let scale = 1;
  for (const [axis, low, high] of [['x', ROOM.left, ROOM.right], ['y', ROOM.floor, ROOM.ceiling], ['z', ROOM.back, ROOM.front]]) {
    if (offset[axis] > 0) scale = Math.min(scale, (high - clearance - target[axis]) / offset[axis]);
    if (offset[axis] < 0) scale = Math.min(scale, (low + clearance - target[axis]) / offset[axis]);
  }
  position.copy(target).addScaledVector(offset, MathUtils.clamp(scale, 0, 1));
  return position;
}

export function cameraPath(fromPosition, fromTarget, toPosition, toTarget) {
  const from = new Spherical().setFromVector3(fromPosition.clone().sub(fromTarget));
  const to = new Spherical().setFromVector3(toPosition.clone().sub(toTarget));
  to.theta = from.theta + Math.atan2(Math.sin(to.theta - from.theta), Math.cos(to.theta - from.theta));
  return { from, to, fromTarget: fromTarget.clone(), toTarget: toTarget.clone() };
}

// Outward scrolling has one endpoint: the entry view, including its direction.
// Returning null at that endpoint makes further wheel input a no-op.
export function overviewPath(position,target,homePosition,homeTarget){
  if(position.distanceToSquared(homePosition)<1e-8&&target.distanceToSquared(homeTarget)<1e-8)return null;
  return cameraPath(position,target,homePosition,homeTarget);
}

// Click and wheel use exactly this path, including its target and wall clearance.
export function cameraPose(path, progress) {
  const t = MathUtils.clamp(progress, 0, 1);
  const target = new Vector3().lerpVectors(path.fromTarget, path.toTarget, t);
  const spherical = new Spherical(
    MathUtils.lerp(path.from.radius, path.to.radius, t),
    MathUtils.lerp(path.from.phi, path.to.phi, t),
    MathUtils.lerp(path.from.theta, path.to.theta, t),
  );
  const position = new Vector3().setFromSpherical(spherical).add(target);
  containCamera(position, target);
  return { position, target };
}
