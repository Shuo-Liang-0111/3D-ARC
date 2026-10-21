import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {createLeakEngine} from "../game/levels/rf06/series-engine.js";
import {ITEM_BASE_Y} from "../game/levels/rf06/home-layout.js";
import {WRENCH_GRIP,WRENCH_JAW,placeWrenchAtGrip,wrenchJawPosition,wrenchHandRotation,wrenchValveHandPoint,wrenchJawEffector} from "../game/levels/rf06/wrench-grip.js";
test("RF06-2 disperses tools over supported surfaces and returns wrench to its own bench",()=>{
 const r=createLeakEngine("rf06-2"),base=createLeakEngine("rf06");let s=r.createInitialState();
 const {wrench,bucket,mop}=s.items;
 assert.ok(Math.hypot(wrench.x-bucket.x,wrench.z-bucket.z)>5);
 assert.ok(Math.hypot(wrench.x-mop.x,wrench.z-mop.z)>4);
 assert.ok(Math.hypot(bucket.x-mop.x,bucket.z-mop.z)>4);
 assert.equal(ITEM_BASE_Y("wrench",wrench),.825);assert.equal(ITEM_BASE_Y("bucket",bucket),.03);
 assert.equal(base.createInitialState().items.wrench.z,1.72);
 s.player={x:wrench.x,z:wrench.z+.65,yaw:Math.PI};
 const pickup=r.getInteraction(s);assert.equal(pickup.item,"wrench");assert.equal(pickup.point.y,.845);
 s=r.interact(s,pickup);s.valveClosed=true;
 const back=r.getInteraction(s);assert.equal(back.type,"return");
 s=r.interact(s,back);assert.equal(s.items.wrench.home,"entry-bench");assert.equal(ITEM_BASE_Y("wrench",s.items.wrench),.825);
});
test("wrench handle stays inside the hand through wrist roll, pitch and robot yaw",()=>{
 const root=new THREE.Group(),grip=new THREE.Vector3(WRENCH_GRIP.x,WRENCH_GRIP.y,WRENCH_GRIP.z),hand=new THREE.Vector3(1,.98,2);
 for(const [x,y,z]of [[0,0,0],[.8,.5,-1.2],[-.4,2.3,.7]]){
  const wrist=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));
  placeWrenchAtGrip(root,hand,wrist);root.updateMatrixWorld(true);
  assert.ok(root.localToWorld(grip.clone()).distanceTo(hand)<1e-10);
  assert.ok(wrenchJawPosition(root).distanceTo(hand)>.15);
 }
});
test("valve rotation uses the wrench jaw as its pivot rather than the palm",()=>{
 const valve=new THREE.Vector3(-3.15,.57,3.078),root=new THREE.Group();
 for(const angle of [-.32,0,.32]){
  const tool=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,angle,"ZYX"));
  const hand=wrenchValveHandPoint(valve,tool);
  placeWrenchAtGrip(root,hand,wrenchHandRotation(tool));
  assert.ok(wrenchJawPosition(root).distanceTo(valve)<1e-10);
  assert.ok(hand.distanceTo(valve)>.15);
 }
});
test("contact-calibrated wrist binding preserves resting pose and jaw effector",()=>{
 const root=new THREE.Group(),hand=new THREE.Vector3(4.255,.52,-2.78);
 const wrist=new THREE.Quaternion().setFromEuler(new THREE.Euler(.4,-.9,.7)),mount=wrist.clone().invert();
 placeWrenchAtGrip(root,hand,wrist,mount);
 assert.ok(root.quaternion.angleTo(new THREE.Quaternion())<1e-7);
 const nativeOrigin=hand.clone().sub(new THREE.Vector3(.14,.04,0).applyQuaternion(wrist));
 const jaw=wrenchJawEffector(mount).applyQuaternion(wrist).add(nativeOrigin);
 assert.ok(jaw.distanceTo(wrenchJawPosition(root))<1e-10);
});
