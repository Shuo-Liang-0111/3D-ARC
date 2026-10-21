import fs from 'node:fs';
import * as THREE from 'three';
import { loadUnitreeG1Dex1Model, setUnitreeG1Dex1JointAngle } from '../game/unitree-g1-dex1-model.js';
import { applyMujocoState } from '../game/mujoco-client.js';
import { BrowserArmScript } from '../game/levels/rf15/browser-arm-script.js';
globalThis.ProgressEvent = class ProgressEvent { constructor(type, values) { Object.assign(this, values); this.type = type; } };
const model = await loadUnitreeG1Dex1Model({ url:'http://localhost:4173/local-assets/unitree/g1/g1_29dof_official.glb', groundY:0 });
const robot = new THREE.Group(); robot.add(model); robot.userData.officialModel = model;
robot.position.set(-6.135,0,-12.25); robot.rotation.y = Math.PI;
applyMujocoState(robot, JSON.parse(fs.readFileSync('./authoring/server-production/rf15-browser-physics-v1/standing-state.json')), { id:'g1', setJointAngle:setUnitreeG1Dex1JointAngle }, { groundY:0, projectWorldPose:false });
const arm = new BrowserArmScript(robot,'right'); arm.capture();
const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,-1),new THREE.Vector3(0,-1,0),new THREE.Vector3(-1,0,0)));
for (const [name, point] of [['raise',[-5.955,1.307,-12.28]],['hover',[-5.955,1.307,-12.45]],['grip',[-5.955,1.177,-12.45]]]) {
  const error = arm.plan(new THREE.Vector3(...point),orientation);
  console.log(JSON.stringify({name,error,angles:arm.targetAngles}));
}
for (const angles of [[.5,-.4,0,-.8,0,0,0],[.5,-.7,0,-1,0,0,0],[-.4,-.7,0,-1,0,0,0],[-1,-.8,0,-.8,-.5,.8,.8]]) {
  arm.apply(angles);
  console.log(JSON.stringify({angles,position:arm.graspPose().position}));
}
