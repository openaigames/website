import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Spherical, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ROOM, CAMERA_CLEARANCE, containCamera, cameraPath, cameraPose, syncOrbitPose } from '../scene/camera-motion.mjs';
import { focusDestination } from '../scene/room-focus.mjs';

function inside(position) {
  for (const [axis, low, high] of [['x', ROOM.left, ROOM.right], ['y', ROOM.floor, ROOM.ceiling], ['z', ROOM.back, ROOM.front]]) {
    assert.ok(position[axis] >= low + CAMERA_CLEARANCE - 1e-8, `${axis}: crossed lower wall`);
    assert.ok(position[axis] <= high - CAMERA_CLEARANCE + 1e-8, `${axis}: crossed upper wall`);
  }
}

test('camera stays within all six walls across orbit angles and viewport scales', () => {
  const target = new Vector3(-.5, 2.2, -.2);
  for (let theta = -Math.PI; theta <= Math.PI; theta += .15) {
    for (let phi = .05; phi < Math.PI; phi += .15) {
      for (const radius of [8.3, 27, 44, 90]) {
        const position = new Vector3().setFromSpherical(new Spherical(radius, phi, theta)).add(target);
        const direction = position.clone().sub(target).normalize();
        containCamera(position, target);
        inside(position);
        assert.ok(position.clone().sub(target).normalize().distanceTo(direction) < 1e-8, 'preserves orbit direction');
      }
    }
  }
});

test('screen approach is reversible, reaches the same pose, and stays inside on narrow viewports', () => {
  const target = new Vector3(-.5, 2.2, -.2), screen = new Vector3(-.2, 4.21, -1.446);
  for (const aspect of [.35, .46, 1.06, 1.78, 2.4]) {
    const origin = new Vector3(10.8, 10.6, 22.8).sub(target).multiplyScalar(Math.max(1, 1.45 / aspect)).add(target);
    containCamera(origin, target);
    const destination = screen.clone().add(new Vector3(0, .08, Math.max(7.7, 4.96 / (2 * Math.tan(19 * Math.PI / 180) * aspect * .89))));
    containCamera(destination, screen);
    const path = cameraPath(origin, target, destination, screen);
    for (let step = 0; step <= 100; step++) {
      const forward = cameraPose(path, step / 100), reverse = cameraPose(path, 1 - (100 - step) / 100);
      inside(forward.position);
      assert.ok(forward.position.distanceTo(reverse.position) < 1e-8);
    }
    assert.ok(cameraPose(path, 0).position.distanceTo(origin) < 1e-8);
    assert.ok(cameraPose(path, 1).position.distanceTo(destination) < 1e-8);
    assert.ok(cameraPose(path, 1).target.distanceTo(screen) < 1e-8);
  }
});

test('orbit takeover preserves close-ups and clears old damping without a camera jump',()=>{
  for(const area of ['screen','cabinet','desk','wall'])for(const aspect of [.4,1.06,1.78]){
    const camera=new PerspectiveCamera(),controls=new OrbitControls(camera);
    controls.enableDamping=true;
    const view=focusDestination(area,aspect,new Vector3(-.2,4.21,-1.446));
    camera.position.copy(view.position);controls.target.copy(view.target);camera.lookAt(view.target);
    syncOrbitPose(controls);controls.update();
    assert.ok(camera.position.distanceTo(view.position)<1e-8,`${area}: first orbit update changed the close-up`);
    controls.rotateUp(.002);
    assert.ok(camera.position.distanceTo(view.position)<.1,`${area}: a tiny drag caused a large jump`);
    const visible=camera.position.clone();syncOrbitPose(controls);controls.update();
    assert.ok(camera.position.distanceTo(visible)<1e-8,`${area}: leftover damping moved the new path origin`);
  }
});
