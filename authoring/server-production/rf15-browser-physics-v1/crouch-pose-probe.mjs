import fs from 'node:fs';
import * as THREE from 'three';
import { loadUnitreeG1Dex1Model, setUnitreeG1Dex1JointAngle as joint } from '../../arc-game/game/unitree-g1-dex1-model.js';
import { applyMujocoState } from '../../arc-game/game/mujoco-client.js';
import { BrowserArmScript } from '../../arc-game/game/levels/rf15/browser-arm-script.js';
globalThis.ProgressEvent = class ProgressEvent { constructor(type, values) { Object.assign(this, values); this.type = type; } };
const model = await loadUnitreeG1Dex1Model({ url:'http://localhost:4173/local-assets/unitree/g1/g1_29dof_official.glb', groundY:0 });
const robot = new THREE.Group(); robot.add(model); robot.userData.officialModel = model;
const standing = JSON.parse(fs.readFileSync('./authoring/server-production/rf15-browser-physics-v1/standing-state.json'));
const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1,0,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,-1)));
for (const knee of [2.4,2.7]) for (const waist of [.5]) for (const ankle of [-.87]) for (const lean of [.3,.5]) {
  applyMujocoState(robot, standing, { id:'g1', setJointAngle:joint }, { groundY:0, projectWorldPose:false });
  robot.position.x = 10.3; robot.position.z = -3.37; robot.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
  robot.updateMatrixWorld(true);
  const feet = ['left','right'].map(side=>model.getObjectByName(side+'_ankle_roll_link'));
  const before = feet.reduce((sum,foot)=>sum.add(foot.getWorldPosition(new THREE.Vector3())),new THREE.Vector3()).multiplyScalar(.5);
  for (const side of ['left','right']) {
    joint(model,side+'_hip_pitch_link',-knee-ankle);
    joint(model,side+'_knee_link',knee);
    joint(model,side+'_ankle_pitch_link',ankle);
  }
  joint(model,'torso_link',waist);
  robot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),lean));
  robot.updateMatrixWorld(true);
  const after = feet.reduce((sum,foot)=>sum.add(foot.getWorldPosition(new THREE.Vector3())),new THREE.Vector3()).multiplyScalar(.5);
  robot.position.add(before.sub(after)); robot.updateMatrixWorld(true);
  const arm = new BrowserArmScript(robot,'left'); arm.capture();
  const forward = new THREE.Vector3(1,0,0);
  const secondary = new THREE.Vector3(0,-1,0);
  const rotation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(forward, secondary, new THREE.Vector3().crossVectors(forward,secondary)));
  const error=arm.plan(new THREE.Vector3(10.85,.30,-3.55),rotation);
  console.log(JSON.stringify({knee,waist,ankle,lean,error,root:robot.position,shoulder:arm.joints[0].getWorldPosition(new THREE.Vector3())}));
}
