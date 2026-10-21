import * as THREE from "three";
import { loadUnitreeG1Dex1Model, setUnitreeG1Dex1JointAngle } from "../../game/unitree-g1-dex1-model.js";
import { BrowserArmScript } from "../../game/levels/rf15/browser-arm-script.js";
globalThis.ProgressEvent = class { constructor(type, values) { Object.assign(this, values); this.type = type; } };
const model = await loadUnitreeG1Dex1Model({url:"http://localhost:4173/local-assets/unitree/g1/g1_29dof_official.glb",groundY:0});
const robot = new THREE.Group(); robot.add(model); robot.userData.officialModel = model;
for (const lean of [0.3,0.45,0.6]) {
 setUnitreeG1Dex1JointAngle(model,"torso_link",lean); robot.updateMatrixWorld(true);
 for (const side of ["left","right"]) {
 const arm = new BrowserArmScript(robot,side); arm.capture();
 for(const [kind,forward,height,width] of [["chair",.485,.85,.20],["cart",.48,1.00,.25]]) {
 const target=new THREE.Vector3(side==="left"?width:-width,height,forward);
 console.log(JSON.stringify({lean,side,kind,error:arm.plan(target,null)}));
 }
 }
}

