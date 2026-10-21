import assert from "node:assert/strict";
import * as THREE from "three";
import { loadUnitreeG1Dex1Model, updateUnitreeG1Dex1Model, setUnitreeG1Dex1JointAngle, setUnitreeG1Dex1Grip } from "../game/unitree-g1-dex1-model.js";
import { applyRobotActionPose } from "../game/robot.js";
import { createRobotActionState, beginRobotAction, advanceRobotAction, getRobotActionPose, getRobotPresentationState } from "../game/robot-action.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const release = process.argv[2];
const manifest = release ? JSON.parse(await readFile(resolve(release, ".vite/manifest.json"), "utf8")) : null;
globalThis.ProgressEvent = class { constructor(type, fields) { Object.assign(this, fields); } };
const model = await loadUnitreeG1Dex1Model({url:"http://127.0.0.1:4173/local-assets/unitree/g1/g1_29dof_official.glb",groundY:0});
const robot = new THREE.Group(), cargoGrip = new THREE.Group(), rackPayload = new THREE.Group();
robot.add(model,cargoGrip);cargoGrip.add(rackPayload);
const battery = new THREE.Group();battery.name="rf01-carried-battery";battery.userData.batterySize=[.44,.1833,.22];rackPayload.add(battery);
for(const type of ["red","yellow","blue"]){const parcel=new THREE.Group();parcel.name="sorting-parcel-"+type;parcel.position.y=-.08;rackPayload.add(parcel);}
robot.userData={officialModel:model,robotId:"g1",robotProfile:{setJointAngle:setUnitreeG1Dex1JointAngle,setGrip:setUnitreeG1Dex1Grip},cargoGrip,rackPayload};
const legs=["left","right"].flatMap(side=>["hip_pitch","hip_roll","hip_yaw","knee","ankle_pitch","ankle_roll"].map(j=>side+"_"+j+"_link")).concat(["waist_yaw_link","waist_roll_link","torso_link"]);
const capture=()=>legs.map(n=>model.getObjectByName(n).quaternion.clone());
const palms=()=>["left","right"].map(side=>robot.worldToLocal(model.getObjectByName(side+"_wrist_yaw_link").localToWorld(new THREE.Vector3(side==="left"?.04:-.04,0,.14))));
for(const id of ["rf01","rf01-2","rf01-3"]){
 const key="game/levels/"+id+"/runtime.js";
 const runtime=await import(release?pathToFileURL(resolve(release,manifest[key].file)):"../"+key);
 assert.equal(runtime.createInteractionAnimation,undefined);
 for(const item of ["battery","parcel-red","parcel-yellow","parcel-blue"]){
  let before=runtime.createInitialState();before.player={x:3,z:3,yaw:0};
  let state=structuredClone(before);
  if(item==="battery")state.battery={location:"carried"};
  else {state.carriedItem=item;state.parcels[item.slice(7)].location="carried";}
  const event=item==="battery"?"battery_collected":"crate_collected";
  let action=beginRobotAction(createRobotActionState(),event,before,state);
  assert.equal(action.gesture,"two-hand-lift");
  let phase=new Set();
  for(let frame=0;frame<100;frame++){
   const pose=getRobotActionPose(action,true),visual=getRobotPresentationState(action,state);
   phase.add(action.active?(pose.contactReached?"lift":"reach"):"held");
   assert.equal(item==="battery"?visual.battery.location==="carried":visual.carriedItem===item,pose.contactReached);
   updateUnitreeG1Dex1Model(model,.02,frame*.02,"idle");applyRobotActionPose(robot,pose);runtime.syncRobotPose(robot,pose,state,action);
   if(!action.active)break;
   action=advanceRobotAction(action,.02);
  }
  assert.deepEqual([...phase],["reach","lift","held"]);
  // Existing gait must survive the cargo hook, including root bob and torso sway.
  const frames=[];
  for(let frame=0;frame<24;frame++){
   const pose=getRobotActionPose(action,true);
   updateUnitreeG1Dex1Model(model,.05,frame*.05,"walking",frame*.08);
   applyRobotActionPose(robot,pose);
   const lower=capture(),root=robot.matrix.clone();
   runtime.syncRobotPose(robot,pose,state,action);
   capture().forEach((quat,i)=>assert.ok(quat.angleTo(lower[i])<1e-7,legs[i]+" overwritten while carrying"));
   assert.deepEqual(robot.matrix.elements,root.elements);
   frames.push(capture());
   const p=palms(),mid=p[0].clone().add(p[1]).multiplyScalar(.5);
   const cargoCenter=cargoGrip.position.clone().add(new THREE.Vector3(0,item==="battery"?.1833/2:-.08,0));
   assert.ok(cargoCenter.distanceTo(mid)<1e-6,"cargo follows original palms");
  }
  assert.ok(frames.some(f=>f.some((q,i)=>q.angleTo(frames[0][i])>.05)),"legs still step");
  for(const input of [{move:1},{move:-1},{strafe:1},{turn:1}]){
   const moved=runtime.updateMovement(state,{...input,drain:false},.1);
   assert.ok(Math.hypot(moved.player.x-state.player.x,moved.player.z-state.player.z)+Math.abs(moved.player.yaw-state.player.yaw)>.01,"carrying must allow movement/turning");
  }
  let placed=structuredClone(state);if(item==="battery")placed.battery={location:"ground",x:3,z:3.75};else{placed.carriedItem=null;placed.parcels[item.slice(7)].location="ground";}
  const placing=beginRobotAction(action,item==="battery"?"battery_dropped":"crate_dropped",state,placed);
  if(item!=="battery"){
   const finalState={...placed,lastEvent:"mission_complete",complete:true};
   const finalAction=beginRobotAction(action,runtime.getRobotActionEvent(state,finalState),state,finalState);
   assert.equal(finalAction.kind,"place","last parcel still plays placement before completion overlay");
  }
  const pre=advanceRobotAction(placing,placing.duration*placing.contactProgress-.001);
  assert.equal(getRobotActionPose(pre,false).visualCarrying,true);
  assert.equal(getRobotActionPose(advanceRobotAction(pre,.002),false).visualCarrying,false);
  console.log(id+" "+item+": original lift/place timeline, palm attachment, walking and turning passed");
 }
}
console.log("Final parcel completion retains its placement gesture");
const app=await readFile("game/app.js","utf8");
assert.ok(app.indexOf("runtime.syncRobotPose?.")>app.indexOf("if (!sampledMujocoState) updateRobotAnimation"));
assert.ok(!app.includes('levelId === "rf01" || levelId === "rf01-2") syncRF01BatteryPose'));
