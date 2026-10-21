
import * as THREE from './node_modules/three/build/three.module.js';
import {loadUnitreeG1Dex1Model,setUnitreeG1Dex1JointAngle,updateUnitreeG1Dex1Model} from './game/unitree-g1-dex1-model.js';
import {createHotelAnimation} from './game/levels/rf05/series-animation.js';
import {createHotelEngine} from './game/levels/rf05/series-engine.js';
import {itemPose} from './game/levels/rf05/series-layout.js';
globalThis.ProgressEvent=class{constructor(type,values){Object.assign(this,values);this.type=type;}};
globalThis.location={search:''};
const model=await loadUnitreeG1Dex1Model({url:'http://127.0.0.1:4173/local-assets/unitree/g1/g1_29dof_official.glb',groundY:0});
const robot=new THREE.Group();robot.add(model);robot.userData.officialModel=model;robot.userData.robotProfile={setJointAngle:setUnitreeG1Dex1JointAngle};robot.userData.rackPayload={};
const runtime=createHotelEngine('rf05-2');let s=runtime.createInitialState();
const controller=createHotelAnimation({scene:new THREE.Scene(),carryTemplates:{}},robot,{runtime,getState:()=>s,setState:n=>s=n,stop(){},message(){}});
for(const item of ['towel1','towel2','cup1','cup2']){
 for(let i=0;i<8;i++){
 s=runtime.createInitialState();if(item==='towel2')s.items.towel1.location='slot';
 const p=itemPose(item,s),yaw=i*Math.PI/4;s.player={x:p.x-Math.sin(yaw)*.95,z:p.z-Math.cos(yaw)*.95,yaw};
 if(!runtime.isWalkable(s,s.player.x,s.player.z))continue;
 const selected=runtime.getInteraction(s,{type:'pickup',item});if(!selected)continue;
 const point=new THREE.Vector3(p.x,p.y+controller.grabHeight(item),p.z),stand=controller.standFor(s,point,selected);
 if(!stand){console.log(JSON.stringify({item,i,blocked:true}));continue;}
 s.player=stand;robot.position.set(stand.x,0,stand.z);robot.rotation.set(0,stand.yaw,0);
 updateUnitreeG1Dex1Model(model,.03,0,'idle',0,0);controller.action={selected,stand,point};controller.crouch=0;controller.bend=.45;controller.requestedBend=.45;controller.requestedCrouch=0;controller.posture(0);
 for(const arm of Object.values(controller.arms)){arm.capture();}
 controller.plan(point,controller.twoHanded(s,selected),true);
 for(const arm of Object.values(controller.arms))arm.apply(arm.targetAngles);
 console.log(JSON.stringify({item,i,stand,reach:controller.error(point,controller.twoHanded(s,selected))}));
 }
}
