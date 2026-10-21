import * as THREE from "three";
import { BrowserArmScript } from "../rf15/browser-arm-script.js";
import { InteractionWalk,approachPath } from "../rf15/interaction-walk.js";
import { BINS,binPose,REVISION } from "./series-layout.js";
const vec=p=>new THREE.Vector3(p.x,p.y,p.z),idle=()=>({move:0,strafe:0,turn:0,drain:false});
export function createCourtAnimation(w,r,o){return new CourtAnimation(w,r,o);}
class CourtAnimation{
 constructor(world,robot,options){this.world=world;this.robot=robot;this.options=options;this.arm=new BrowserArmScript(robot,"right");this.walk=new InteractionWalk(this);this.reset();world.controller=this;
 if(new URLSearchParams(location.search).get("tennisqa")==="1")import("./series-qa.js").then(m=>m.installQA(this));}
 get busy(){return !!this.action;}
 reset(){this.action=null;this.walk.reset();this.arm.active=false;this.crouch=this.bend=this.desiredCrouch=this.desiredBend=0;this.lastResult=null;this.contacts=[];this.falling=null;this.qaPaused=false;this.options.runtime.resetWeatherClock?.();}
 motionInput(s){return this.qaPaused?idle():this.action?.phase==="align"?this.walk.input(s):this.action?idle():null;}
 holdPoint(){return this.robot.localToWorld(new THREE.Vector3(-.24,.84,.25));}
 target(p,plan=false){if(!this.arm.active)this.arm.capture();plan?this.arm.plan(p):this.arm.solve(p,null,5);}
 standFor(s,p){
 const candidates=[];
 for(const radius of (p.y<.2?[.24,.26,.28]:[.52,.58,.64,.7]))for(let i=0;i<32;i++){
 const yaw=i*Math.PI/16,stand={x:p.x-Math.sin(yaw)*radius+Math.cos(yaw)*.12,z:p.z-Math.cos(yaw)*radius-Math.sin(yaw)*.12,yaw};
 if(this.options.runtime.isWalkable({...s,player:{...s.player,yaw}},stand.x,stand.z))candidates.push({stand,score:Math.hypot(s.player.x-stand.x,s.player.z-stand.z)*.2+radius*3});
 }
 candidates.sort((a,b)=>a.score-b.score);return candidates.find(c=>approachPath(s,c.stand,this.options.runtime))?.stand;
 }
 interact(){
 if(this.action)return true;
 const before=this.options.getState();if(before.complete||before.failed||before.settling)return true;
 const s=this.options.runtime.chargeInteraction(before);this.options.setState(s);
 if(s.failed){this.options.message(this.options.runtime.eventMessages.progress_depleted);return true;}
 const selected=this.options.runtime.getInteraction(s);
 if(!selected){this.options.message("靠近网球或球筐后按 F");return true;}
 let pose;
 if(selected.type==="pickup")pose={...s.items[selected.item]};
 else if(selected.type==="deliver"){
  const used=new Set(Object.values(s.items).filter(b=>b.location==="bin"&&b.bin===selected.bin).map(b=>b.slot));let index=0;while(used.has(index))index++;
  pose=binPose(selected.bin,index);
 }else pose=this.options.runtime.dropPose(s);
 if(!pose){this.options.message("这里不能安全放球");return true;}
 if(selected.type==="drop")selected.releasePoint={...pose};
 const point=vec(pose);point.y+=.034;
 if(selected.type==="deliver")point.y=1.0;
 // Retrieving a misplaced ball reaches through the open basket from above.
 const stand=this.standFor(s,point);if(!stand){this.options.message("操作位置被挡住，请从球筐正面靠近");return true;}
 this.options.stop();this.action={selected,point,pose,fromBin:selected.type==="pickup"&&pose.location==="bin",stand,time:0,total:0,phase:"align",committed:false};
 if(!this.walk.begin(stand,stand.yaw))this.action=null;return true;
 }
 phase(name){this.action.phase=name;this.action.time=0;}
 posture(dt){
 this.crouch+=THREE.MathUtils.clamp(this.desiredCrouch-this.crouch,-dt*.7,dt*.7);
 this.bend+=THREE.MathUtils.clamp(this.desiredBend-this.bend,-dt,dt);
 const m=this.robot.userData.officialModel,set=this.robot.userData.robotProfile.setJointAngle;
 const feet=["left","right"].map(s=>m.getObjectByName(s+"_ankle_roll_link"));
 const center=()=>feet.reduce((v,f)=>v.add(f.getWorldPosition(new THREE.Vector3())),new THREE.Vector3()).multiplyScalar(.5);
 this.robot.updateMatrixWorld(true);const before=center();
 if(this.crouch>.001)for(const side of ["left","right"]){const k=this.crouch*2.7,a=-this.crouch*.87;set(m,side+"_hip_pitch_link",-k-a);set(m,side+"_knee_link",k);set(m,side+"_ankle_pitch_link",a);}
 this.robot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),this.bend*.25));
 set(m,"torso_link",.25+this.bend*.45);this.robot.updateMatrixWorld(true);
 if(this.crouch>.001||this.bend>.001)this.robot.position.add(before.sub(center()));this.robot.updateMatrixWorld(true);
 }
 commit(){
 const a=this.action,s=this.options.getState(),n=this.options.runtime.interact(s,a.selected,{charge:false});
 if(n.interactions===s.interactions){this.lastResult={type:"cancelled",event:n.lastEvent};this.recover();return;}
 a.committed=true;
 this.contacts.push({type:a.selected.type,item:a.selected.item,error:this.arm.graspPose().position.distanceTo(a.point),revision:REVISION});
 this.lastResult=this.contacts.at(-1);
 if(a.selected.type==="deliver")this.falling={item:a.selected.item,from:a.point.y-.034,to:n.items[a.selected.item].y,time:0};
 if(n.complete){n.complete=false;n.settling=true;a.complete=true;}
 this.options.setState(n);this.options.message(this.options.runtime.eventMessages[n.lastEvent]??"");
 if(n.carriedItem){if(a.fromBin){this.target(a.point.clone().setY(1.05),true);this.phase("raise");}else{this.desiredCrouch=this.desiredBend=0;this.phase("lift");}}else this.recover();
 }
 recover(){this.desiredCrouch=this.desiredBend=0;this.phase("recover");if(this.action.rest)this.arm.targetAngles=[...this.action.rest];}
 cancel(){if(this.action)this.recover();}
 frame(delta,running){
 if(!running)this.options.runtime.resetWeatherClock?.();
 if(this.qaStopAt&&this.action?.phase===this.qaStopAt){this.qaPaused=true;this.qaStopAt=null;}
 const dt=running&&!this.qaPaused?Math.min(.05,delta):0,s=this.options.getState(),a=this.action;
 if(s.failed){this.action=null;this.arm.active=false;}
 if(this.robot.userData.rackPayload)this.robot.userData.rackPayload.visible=false;
 if(a?.phase==="align"){this.walk.update(dt);this.walk.draw(dt);}
 if(a||s.carriedItem||this.crouch||this.bend)this.posture(dt);
 if(this.arm.active)this.arm.apply();
 if(a&&dt&&!s.failed){
  a.time+=dt;a.total+=dt;
  if(a.total>35&&a.phase!=="recover"){this.lastResult={type:"timeout",phase:a.phase,error:this.arm.graspPose().position.distanceTo(a.point)};this.options.message("未能触及网球，请重新靠近");this.recover();}
  if(a.phase==="align"&&this.walk.ready){this.arm.capture();a.rest=[...this.arm.angles];this.desiredCrouch=a.point.y<.18?1.04:0;this.desiredBend=a.point.y<.18?.75:a.point.y<.7?1.2:1;this.phase("prepare");}
  else if(a.phase==="prepare"&&Math.abs(this.crouch-this.desiredCrouch)<.01&&Math.abs(this.bend-this.desiredBend)<.01){this.target(a.fromBin?a.point.clone().setY(1.05):a.point,true);this.phase(a.fromBin?"hover":"reach");}
  else if(a.phase==="hover"){const p=a.point.clone().setY(1.05);this.target(p);if(a.time>.4&&this.arm.graspPose().position.distanceTo(p)<.025){this.target(a.point,true);this.phase("reach");}}
  else if(a.phase==="raise"){const p=a.point.clone().setY(1.05);this.target(p);if(a.time>.4&&this.arm.graspPose().position.distanceTo(p)<.025){this.desiredCrouch=this.desiredBend=0;this.phase("lift");}}
  else if(a.phase==="reach"){
   this.target(a.point);
   if(a.time>.4&&this.arm.graspPose().position.distanceTo(a.point)<.02){this.phase("contact");}
   else if(a.time>1.6&&a.time-(a.lastPlan??0)>1.6){this.target(a.point,true);a.lastPlan=a.time;}
  }else if(a.phase==="contact"){this.target(a.point);if(a.time>.25&&this.arm.graspPose().position.distanceTo(a.point)<.02)this.commit();}
  else if(a.phase==="lift"){
   this.target(this.holdPoint(),a.time>2&&a.time-(a.lastPlan??0)>2);if(a.time-(a.lastPlan??0)>2)a.lastPlan=a.time;
   if(a.time>1.1&&this.crouch<.01&&this.bend<.01&&this.arm.graspPose().position.distanceTo(this.holdPoint())<.055)this.action=null;
  }else if(a.phase==="recover"&&a.time>1.5&&this.crouch<.01&&this.bend<.01&&!this.falling){
   if(a.complete&&!this.options.getState().failed)this.options.setState({...this.options.getState(),complete:true,settling:false});
   this.action=null;if(!this.options.getState().carriedItem)this.arm.active=false;
  }
 }
 const current=this.options.getState(),held=current.carriedItem;
 if(held&&!this.action)this.target(this.holdPoint());
 if(this.arm.active){this.arm.update(dt);this.arm.apply();}
 if(held){const p=this.arm.graspPose(),root=this.world.items[held];root.visible=true;root.position.copy(p.position).y-=.034;this.robot.userData.robotProfile.setGrip?.(this.robot.userData.officialModel,.68);}
 if(this.falling){const f=this.falling;f.time+=dt;const root=this.world.items[f.item];root.position.y=Math.max(f.to,f.from-4.9*f.time*f.time);if(root.position.y<=f.to)this.falling=null;}
 const shell=document.querySelector("#game-shell");if(shell)shell.dataset.tennisAnimation=this.action?.phase??"idle";
 this.qaUpdate?.();
 }
 snapshot(){return {revision:REVISION,phase:this.action?.phase??"idle",selected:this.action?.selected,stand:this.action?.stand,error:this.action?this.arm.graspPose().position.distanceTo(this.action.point):null,contacts:this.contacts,lastResult:this.lastResult,crouch:this.crouch,bend:this.bend,walk:this.walk.snapshot()};}
}
