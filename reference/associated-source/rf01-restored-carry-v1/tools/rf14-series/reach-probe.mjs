import * as THREE from 'three';
import {loadUnitreeG1Dex1Model,setUnitreeG1Dex1JointAngle as set} from '../../game/unitree-g1-dex1-model.js';
import {BrowserArmScript} from '../../game/levels/rf15/browser-arm-script.js';
globalThis.ProgressEvent=class {constructor(t,v){Object.assign(this,v);}};
const m=await loadUnitreeG1Dex1Model({url:'http://localhost:4173/local-assets/unitree/g1/g1_29dof_official.glb',groundY:0});
const r=new THREE.Group();r.add(m);r.userData.officialModel=m;
const arm=new BrowserArmScript(r,'right'),feet=['left','right'].map(s=>m.getObjectByName(s+'_ankle_roll_link'));
const center=()=>feet.reduce((v,f)=>v.add(f.getWorldPosition(new THREE.Vector3())),new THREE.Vector3()).multiplyScalar(.5);
for(const radius of [.65,.7,.75])for(const bend of [1.2,1.4,1.6]){const crouch=0;
 r.position.set(0,0,0);r.quaternion.identity();m.traverse(o=>{if(m.userData.restPose.has(o.name))o.quaternion.copy(m.userData.restPose.get(o.name));});r.updateMatrixWorld(true);const before=center();
 for(const side of ['left','right']){const k=crouch*2.7,a=-crouch*.87;set(m,side+'_hip_pitch_link',-k-a);set(m,side+'_knee_link',k);set(m,side+'_ankle_pitch_link',a);}
 r.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),bend*.25));set(m,'torso_link',.25+bend*.45);r.updateMatrixWorld(true);r.position.add(before.sub(center()));r.updateMatrixWorld(true);
 arm.capture();const target=new THREE.Vector3(-.12,.674,radius);const error=arm.plan(target);arm.apply(arm.targetAngles);
 console.log(JSON.stringify({radius,bend,error,root:r.position.toArray(),hand:arm.graspPose().position.toArray()}));
}
