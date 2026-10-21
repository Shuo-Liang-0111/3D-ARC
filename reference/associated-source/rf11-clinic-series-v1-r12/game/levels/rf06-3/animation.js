import * as THREE from "three";
import {LeakAnimation} from "../rf06/series-animation.js";
export function createPestAnimation(world,robot,options){
 if(!robot.userData.officialModel?.getObjectByName("right_shoulder_pitch_link"))throw Error("RF-06-3 animated interaction requires the selected G1 model");
 world.assetRoots.items.spray=world.pesticide;
 return new PestAnimation(world,robot,options);
}
class PestAnimation extends LeakAnimation{
 constructor(w,r,o){super(w,r,o);if(new URLSearchParams(location.search).get("rf06qa")==="1")import("./qa.js").then(m=>m.installPestQA(this));}
 holdPoint(){return this.robot.localToWorld(new THREE.Vector3(-.16,.88,.40));}
 nozzle(){this.heldRoot.updateMatrixWorld(true);const p=this.heldRoot.localToWorld(new THREE.Vector3(0,.222,.026)),d=new THREE.Vector3(0,0,1).applyQuaternion(this.heldRoot.getWorldQuaternion(new THREE.Quaternion())).normalize();return {origin:{x:p.x,y:p.y,z:p.z},direction:{x:d.x,y:d.y,z:d.z}};}
 interact(){
  if(this.busy)return true;
  const s=this.options.getState();
  if(s.carriedItem!=="spray")return super.interact();
  if(s.complete||s.failed||s.pendingComplete||s.cooldown>0)return true;
  const before=s.shots,next=this.options.runtime.interact(s,{type:"spray",...this.nozzle()});
  this.options.setState(next);
  if(next.shots>before){this.lastResult={type:"spray",hit:next.kills-s.kills,duration:.18,nozzle:this.nozzle()};this.contacts.push(this.lastResult);this.options.message(this.options.runtime.eventMessages[next.lastEvent]??"");}
  return true;
 }
 frame(dt,running){
  super.frame(dt,running);
  const s=this.options.getState();if(s.carriedItem==="spray"){
   const p=this.arm.graspPose().position;this.heldRoot.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),s.player.yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),.65));
   this.heldRoot.position.copy(p).sub(new THREE.Vector3(0,.11,0).applyQuaternion(this.heldRoot.quaternion));
  }
 }
}
