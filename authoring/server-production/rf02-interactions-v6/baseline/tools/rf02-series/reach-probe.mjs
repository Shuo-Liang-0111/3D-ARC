import * as THREE from "three";
import {loadUnitreeG1Dex1Model} from "../../game/unitree-g1-dex1-model.js";
import {BrowserArmScript} from "../../game/levels/rf15/browser-arm-script.js";
globalThis.ProgressEvent = class {constructor(type, values){Object.assign(this,values);this.type=type;}};
const model=await loadUnitreeG1Dex1Model({url:"http://localhost:4173/local-assets/unitree/g1/g1_29dof_official.glb",groundY:0});
const robot=new THREE.Group();robot.add(model);robot.userData.officialModel=model;robot.updateMatrixWorld(true);
for(const side of ["left","right"]){
 const arm=new BrowserArmScript(robot,side);arm.capture();
 console.log(side,"shoulder",arm.joints[0].getWorldPosition(new THREE.Vector3()).toArray(),"rest",arm.graspPose().position.toArray());
 for(const forward of [.53,.48,.43,.38])for(const height of [.84,1.04,1.26]){
 const target=new THREE.Vector3(side==="left"?.20:-.20,height,forward);
 const error=arm.plan(target,null);
 console.log(JSON.stringify({side,forward,height,error}));
 }
}
