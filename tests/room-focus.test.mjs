import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Ray,Vector3} from 'three';
import {focusAreaForRay,focusDestination,cabinetDetailForRay,panCabinetPath,canScrollList,wheelGoal,resizeFocusPath,roomFov,roomHome} from '../scene/room-focus.mjs';
import {ROOM,CAMERA_CLEARANCE,cameraPath,cameraPose,overviewPath,containCamera} from '../scene/camera-motion.mjs';

test('pointer rays distinguish the screen, cabinet, desktop and left wall',()=>{
  const ray=(from,to)=>new Ray(new Vector3(...from),new Vector3(...to).sub(new Vector3(...from)).normalize());
  assert.equal(focusAreaForRay(ray([0,5,25],[0,4,-1.4])),'screen');
  assert.equal(focusAreaForRay(ray([0,10,25],[0,8,-3.5])),'cabinet');
  assert.equal(focusAreaForRay(ray([0,10,20],[4,0,3])),'desk');
  assert.equal(focusAreaForRay(ray([0,6,8],[-11.67,6,8])),'wall');
});
test('every focus path remains in the room and returns to the same starting view',()=>{
  const origin=new Vector3(12.5,11.4,27.3),target=new Vector3(-.5,1.1,1.2),screen=new Vector3(-.2,4.21,-1.446);
  for(const area of ['screen','cabinet','desk','wall'])for(const aspect of [.4,1.06,1.78]){
    const view=focusDestination(area,aspect,screen),path=cameraPath(origin,target,view.position,view.target);
    for(let i=0;i<=40;i++){
      const {position}=cameraPose(path,i/40);
      for(const [axis,min,max] of [['x',ROOM.left,ROOM.right],['y',ROOM.floor,ROOM.ceiling],['z',ROOM.back,ROOM.front]]){
        assert.ok(position[axis]>=min+CAMERA_CLEARANCE-1e-8&&position[axis]<=max-CAMERA_CLEARANCE+1e-8);
      }
    }
    assert.ok(cameraPose(path,0).position.distanceTo(origin)<1e-8);
    assert.ok(cameraPose(path,1).position.distanceTo(view.position)<1e-8);
  }
});
test('menus consume the wheel only while they have content to scroll in that direction',()=>{
  assert.equal(canScrollList({scrollHeight:200,clientHeight:250,scrollTop:0},100),false);
  assert.equal(canScrollList({scrollHeight:500,clientHeight:250,scrollTop:0},100),true);
  assert.equal(canScrollList({scrollHeight:500,clientHeight:250,scrollTop:0},-100),false);
  assert.equal(canScrollList({scrollHeight:500,clientHeight:250,scrollTop:250},100),false);
});

test('reversing a wheel gesture immediately moves back from the visible pose',()=>{
  assert.ok(wheelGoal(.35,.9,36)<.35,'pending forward motion must not delay retreat');
  assert.ok(wheelGoal(.65,.1,-42)>.65,'pending retreat must not delay approach');
  let goal=1;for(let i=0;i<4;i++)goal=wheelGoal(goal,goal,90);
  assert.equal(goal,0,'four ordinary notches return through the full path');
});

test('resizing a focused room keeps the original return point',()=>{
  const origin=new Vector3(12.5,11.4,27.3),target=new Vector3(-.5,1.1,1.2),screen=new Vector3(-.2,4.21,-1.446);
  for(const area of ['screen','cabinet','desk','wall']){
    const view=focusDestination(area,1.78,screen);
    let path=cameraPath(origin,target,view.position,view.target);
    for(const aspect of [1.06,1.78,1.06])path=resizeFocusPath(path,area,aspect,screen);
    assert.ok(cameraPose(path,0).position.distanceTo(origin)<1e-8);
    assert.ok(cameraPose(path,0).target.distanceTo(target)<1e-8);
    assert.ok(cameraPose(path,1).position.distanceTo(origin)>1);
  }
});

test('outward travel stops at the entry view and cannot continue behind it',()=>{
  const screen=new Vector3(-.2,4.21,-1.446);
  for(const aspect of [.4,1.06,1.78]){
    const {position:home,target}=roomHome(aspect);
    for(const area of ['screen','cabinet','desk','wall']){
      const near=focusDestination(area,aspect,screen),path=overviewPath(near.position,near.target,home,target);
      const arrived=cameraPose(path,1);
      assert.ok(arrived.position.distanceTo(home)<1e-8);
      assert.ok(arrived.target.distanceTo(target)<1e-8);
      assert.equal(overviewPath(arrived.position,arrived.target,home,target),null);
    }
    // A manually rotated overview must recover the original viewing direction.
    const rotated=home.clone();rotated.x-=3;
    const arrived=cameraPose(overviewPath(rotated,target,home,target),1);
    assert.ok(arrived.position.distanceTo(home)<1e-8);
    assert.equal(overviewPath(home,target,home,target),null);
  }
});

test('cabinet detail follows the pointed shelf and reverses to the cabinet overview',()=>{
  const screen=new Vector3(-.2,4.21,-1.446),overview=focusDestination('cabinet',1.06,screen);
  for(const shelf of [[-6,8,-3.2],[4,8,-3.2],[-7.8,3.5,-3.2],[7.8,1.5,-3.2]]){
    const ray=new Ray(overview.position.clone(),new Vector3(...shelf).sub(overview.position).normalize());
    const detail=cabinetDetailForRay(ray);assert.ok(detail);
    assert.ok(Math.abs(detail.x-shelf[0])<1,'focus stays on the pointed shelf');
    const near=focusDestination('cabinet',1.06,screen,detail);
    assert.ok(near.position.distanceTo(detail)<overview.position.distanceTo(detail)*.5,'cartridges are at least twice as large');
    let path=cameraPath(overview.position,overview.target,near.position,near.target);
    path=resizeFocusPath(path,'cabinet',1.78,screen,detail);
    assert.ok(cameraPose(path,0).position.distanceTo(overview.position)<1e-8);
    assert.ok(cameraPose(path,1).target.distanceTo(detail)<1e-8);
    assert.ok(cameraPose(path,1).position.z>ROOM.back+CAMERA_CLEARANCE);
  }
  assert.equal(cabinetDetailForRay(new Ray(new Vector3(0,5,20),new Vector3(0,1,0))),null);
});

test('phone entry frames the playable desk and focused screen without retreating through a wall',()=>{
 for(const [width,height] of [[320,740],[360,800],[390,844],[430,932],[844,390]]){
  const aspect=width/height,{position,target}=roomHome(aspect);
  const camera=new PerspectiveCamera(roomFov(aspect),aspect,.1,100);
  camera.position.copy(position);camera.lookAt(target);camera.updateMatrixWorld();
  const screen=new Vector3(-.2,4.21,-1.446);
  for(const point of [screen,new Vector3(0,1,1.8)]){
   const projected=point.clone().project(camera);
   assert.ok(Math.abs(projected.x)<.8&&Math.abs(projected.y)<.7,`${width}: television or console outside central view`);
  }
  if(aspect<.8){
   const left=screen.clone().add(new Vector3(-2.48,0,0)).project(camera);
   const right=screen.clone().add(new Vector3(2.48,0,0)).project(camera);
   assert.ok((right.x-left.x)/2>.27,'portrait television must occupy enough width to tap');
  }
  for(const [axis,min,max] of [['x',ROOM.left,ROOM.right],['y',ROOM.floor,ROOM.ceiling],['z',ROOM.back,ROOM.front]])assert.ok(position[axis]>=min+CAMERA_CLEARANCE&&position[axis]<=max-CAMERA_CLEARANCE);
  const near=focusDestination('screen',aspect,screen,null,camera.fov);
  camera.position.copy(near.position);camera.lookAt(near.target);camera.updateMatrixWorld();
  for(const x of [-2.48,2.48])assert.ok(Math.abs(screen.clone().add(new Vector3(x,0,0)).project(camera).x)<.91);
 }
});

test('close-up shelf drags reach both ends without orbiting, escaping the room or changing the return point',()=>{
 for(const aspect of [.46,1.06,1.78])for(const progress of [.2,.7,1]){
  const fov=roomFov(aspect),screen=new Vector3(-.2,4.21,-1.446),overview=focusDestination('cabinet',aspect,screen,null,fov);
  let detail=new Vector3(0,8,-3.2),near=focusDestination('cabinet',aspect,screen,detail,fov);
  let path=cameraPath(overview.position,overview.target,near.position,near.target);
  const offset=cameraPose(path,progress).position.clone().sub(cameraPose(path,progress).target);
  for(const dx of [9000,-9000,500,-500]){
   ({path,detail}=panCabinetPath(path,progress,detail,dx,844,fov));
   assert.ok(detail.x>=-7.5&&detail.x<=7.5);
   if(dx===9000)assert.equal(detail.x,-7.5);
   if(dx===-9000)assert.equal(detail.x,7.5);
   const pose=cameraPose(path,progress);
   assert.ok(pose.position.clone().sub(pose.target).distanceTo(offset)<1e-7,'shelf drag must preserve angle and distance');
   assert.ok(cameraPose(path,0).position.distanceTo(overview.position)<1e-7,'zoom out must retain the original overview');
   for(let p=0;p<=1;p+=.1){const {position}=cameraPose(path,p);assert.ok(position.x>ROOM.left+CAMERA_CLEARANCE-.001&&position.x<ROOM.right-CAMERA_CLEARANCE+.001);}
  }
 }
});

test('entering either side cabinet at a lower cubby keeps its category and bottom shelf in view',()=>{
 for(const [width,height] of [[360,800],[390,844],[919,863],[1280,720],[844,390]])for(const side of [-1,1]){
  const aspect=width/height,fov=roomFov(aspect),screen=new Vector3(-.2,4.21,-1.446);
  const overview=focusDestination('cabinet',aspect,screen,null,fov);
  const ray=new Ray(overview.position.clone(),new Vector3(side*7.8,1.5,-3.2).sub(overview.position).normalize());
  const detail=cabinetDetailForRay(ray),near=focusDestination('cabinet',aspect,screen,detail,fov);
  const camera=new PerspectiveCamera(fov,aspect,.1,100);
  camera.position.copy(near.position);camera.lookAt(near.target);camera.updateMatrixWorld();
  for(const x of [side*7.8-1.025,side*7.8+1.025])for(const y of [.14,6.28,6.66]){
   const point=new Vector3(x,y,-2.57).project(camera);
   assert.ok(Math.abs(point.x)<.95&&Math.abs(point.y)<.9,`${width}×${height}: side ${side}, shelf point ${x},${y} is cropped`);
  }
 }
});

test('vertical and diagonal shelf drags preserve angle, room bounds and the original zoom-out view',()=>{
 for(const aspect of [.46,1.06,1.78])for(const side of [-1,1])for(const progress of [.2,.7,1]){
  const fov=roomFov(aspect),screen=new Vector3(-.2,4.21,-1.446),overview=focusDestination('cabinet',aspect,screen,null,fov);
  let detail=new Vector3(side*7.5,3.55,-3.2),near=focusDestination('cabinet',aspect,screen,detail,fov);
  let path=cameraPath(overview.position,overview.target,near.position,near.target);
  const start=cameraPose(path,progress),offset=start.position.clone().sub(start.target);
  for(const [dx,dy] of [[0,120],[0,-120],[0,9000],[0,-9000],[500,500],[-500,-500]]){
   const previous=detail.clone();
   ({path,detail}=panCabinetPath(path,progress,detail,dx,844,fov,dy));
   assert.ok(detail.y>=1.3&&detail.y<=8);
   if(dy>0)assert.ok(detail.y>=previous.y,'pulling down should reveal the upper shelves');
   if(dy<0)assert.ok(detail.y<=previous.y,'pushing up should reveal the lower shelves');
   if(dy===9000)assert.equal(detail.y,8);
   if(dy===-9000)assert.equal(detail.y,1.3);
   const pose=cameraPose(path,progress);
   assert.ok(pose.position.clone().sub(pose.target).distanceTo(offset)<1e-7);
   assert.ok(cameraPose(path,0).position.distanceTo(overview.position)<1e-7);
   assert.ok(cameraPose(path,0).target.distanceTo(overview.target)<1e-7);
   for(let p=0;p<=1;p+=.1){
    const {position}=cameraPose(path,p);
    for(const [axis,min,max] of [['x',ROOM.left,ROOM.right],['y',ROOM.floor,ROOM.ceiling],['z',ROOM.back,ROOM.front]]){
     assert.ok(position[axis]>=min+CAMERA_CLEARANCE-1e-7&&position[axis]<=max-CAMERA_CLEARANCE+1e-7);
    }
   }
  }
 }
});
