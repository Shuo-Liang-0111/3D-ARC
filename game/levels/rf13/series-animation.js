import * as THREE from "three";
import {scaleMujocoVelocityForFrontend} from "../../mujoco-client.js";
import {BrowserArmScript} from "../rf15/browser-arm-script.js";
import {InteractionWalk,approachPath} from "../rf15/interaction-walk.js";
import {PREPARATIONS} from "./level.js";
import {SERIES_REVISION as REVISION} from "./series-engine.js";
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const TYPES=Object.fromEntries(["gloves","gauze","dressings","forms","empty-box"].map(id=>[id,{grip:.11}]));
const WIDTHS={gloves:.10,gauze:.17,dressings:.15,forms:.15,"empty-box":.083,chair:.23,trolley:.23};
const idle=()=>({move:0,strafe:0,turn:0,drain:false}),up=new THREE.Vector3(0,1,0);
export function createClinicAnimation(world,robot,options){
 if(!robot.userData.officialModel?.getObjectByName("right_shoulder_pitch_link"))throw Error("Clinic F animation requires the G1 arm contract");
 return new ClinicAnimation(world,robot,options);
}
export class ClinicAnimation{
 constructor(world,robot,options){
  Object.assign(this,{world,robot,options});this.arms={};
  for(const side of ["left","right"])this.arms[side]=new BrowserArmScript(robot,side);
  this.walk=new InteractionWalk(this);this.heldRoot=new THREE.Group();world.scene.add(this.heldRoot);
  for(const [type,model]of Object.entries(world.carryTemplates)){const m=model.clone(true);m.name=type;m.visible=false;this.heldRoot.add(m);}
  this.reset();world.controller=this;
  if(new URLSearchParams(location.search).get("qa")==="clinic")import("./series-qa.js").then(m=>m.installClinicQA(this));
 }
 reset(){this.action=null;this.qaDrive=null;this.walk?.reset();this.crouch=0;this.bend=0;this.wantCrouch=0;this.wantBend=0;this.pendingCompletion=false;this.heldRoot.visible=false;this.contacts=[];this.lastResult=null;for(const arm of Object.values(this.arms))arm.active=false;}
 get busy(){return Boolean(this.action||this.options.getState().attachment||this.qaDrive);}
 standFor(s,p,a){
  if(a.type==="prepare"){
   const prep=PREPARATIONS.find(v=>v.id===a.preparation),pos=s.furniturePositions?.[prep.id]??prep,dir=prep.id==="chair"?-1:1;
   const stand={x:pos.x-dir*.90,z:pos.z,yaw:dir*Math.PI/2};
   return this.options.runtime.isWalkable({...s,player:stand},stand.x,stand.z)&&approachPath(s,stand,this.options.runtime)?stand:null;
  }

  if(["release","drop"].includes(a.type))return {...s.player};
  if(["terminal","open"].includes(a.type)&&s.player.z<2.75)return null;
  const candidates=[];
  // Sample nearby supported stances with clearance for the frozen robot envelope.
  const radii=p.y<.15?[.58,.62,.66,.7]:[.46,.54,.62,.70,.78,.86,.94,1.0];
  for(const r of radii)for(let i=0;i<96;i++){
   const yaw=i*Math.PI/48,offset=this.twoHanded(s,a)?0:.14,stand={x:p.x-Math.sin(yaw)*r+Math.cos(yaw)*offset,z:p.z-Math.cos(yaw)*r-Math.sin(yaw)*offset,yaw};
   if(![[0,0],[.045,0],[-.045,0],[0,.045],[0,-.045]].every(([dx,dz])=>this.options.runtime.isWalkable({...s,player:stand},stand.x+dx,stand.z+dz))||!this.options.runtime.getInteraction({...s,player:stand},a))continue;
   candidates.push({stand,score:distance(s.player,stand)*.2+r*5+Math.abs(Math.sin(yaw*2))*.1});
  }
  candidates.sort((a,b)=>a.score-b.score);
  return candidates.find(c=>{
   const path=approachPath(s,c.stand,this.options.runtime);if(!path)return false;
   const length=path.reduce((sum,p,i)=>sum+distance(i?path[i-1]:s.player,p),0);
   return length<=1.5;
  })?.stand??null;
 }
 twoHanded(s,a){return ["grip","release"].includes(a.type)||["pickup","deliver","return","drop","prepare"].includes(a.type)||Boolean(s.carriedItem);}
 gripHeight(id){return id?.startsWith("empty-")?.11:TYPES[id]?.grip??0;}
 interact(){
  if(this.action)return true;
  const s=this.options.getState(),a=this.options.runtime.getInteraction(s);
  if(!a||a.blocked){const n=this.options.runtime.interact(s);this.options.setState(n);this.options.message(this.options.runtime.eventMessages[n.lastEvent]);return true;}
  const point=new THREE.Vector3(a.point.x,a.point.y,a.point.z);
  if(["pickup","return","deliver","drop"].includes(a.type))point.y+=this.gripHeight(a.item??s.carriedItem);
  const stand=this.standFor(s,point,a);if(!stand){this.options.message("操作位置被挡住，请从通道一侧靠近");return true;}
  this.options.stop();this.action={selected:a,point,stand,two:this.twoHanded(s,a),phase:"align",time:0,total:0,rest:{}};
  if(a.type==="open"){for(const arm of Object.values(this.arms))arm.capture();this.action.rest=Object.fromEntries(Object.entries(this.arms).map(([side,arm])=>[side,[...arm.angles]]));this.wantBend=1;this.phase("prepare");}
  else if(a.type==="release"){this.action.rest=this.gripRest??{};this.phase("release");}
  else if(!this.walk.begin(stand,stand.yaw))this.action=null;
  return true;
 }
 motionInput(s,input={}){
  if(["align","move-furniture"].includes(this.action?.phase))return this.walk.input(s);
  if(this.action)return idle();
  if(this.qaDrive){const q=this.qaDrive.input;return scaleMujocoVelocityForFrontend({...idle(),...q,drain:Boolean(q.move||q.strafe)},this.options.runtime.LEVEL);}
  return s.attachment?scaleMujocoVelocityForFrontend(input,this.options.runtime.LEVEL):null;
 }
 phase(name){this.action.phase=name;this.action.time=0;}
 posture(dt){
  this.crouch+=THREE.MathUtils.clamp(this.wantCrouch-this.crouch,-dt*.7,dt*.7);
  this.bend+=THREE.MathUtils.clamp(this.wantBend-this.bend,-dt,dt);
  const m=this.robot.userData.officialModel,set=this.robot.userData.robotProfile.setJointAngle;
  const feet=["left","right"].map(side=>m.getObjectByName(side+"_ankle_roll_link"));
  const center=()=>feet.reduce((v,f)=>v.add(f.getWorldPosition(new THREE.Vector3())),new THREE.Vector3()).multiplyScalar(.5);
  this.robot.updateMatrixWorld(true);const before=center();
  if(this.crouch>.001)for(const side of ["left","right"]){const knee=this.crouch*2.7,ankle=-this.crouch*.87;set(m,side+"_hip_pitch_link",-knee-ankle);set(m,side+"_knee_link",knee);set(m,side+"_ankle_pitch_link",ankle);}
  const ground=this.action?.point.y<.18;
  this.robot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),this.bend*(ground?.5:.25)));
  set(m,"torso_link",.25+this.bend*(ground?.85:.45));this.robot.updateMatrixWorld(true);
  if(this.crouch>.001||this.bend>.001)this.robot.position.add(before.sub(center()));this.robot.updateMatrixWorld(true);
 }
 targets(p,two){
  const s=this.options.getState(),a=this.action?.selected,id=a?.item??s.carriedItem??a?.preparation;
  const width=WIDTHS[id?.startsWith("empty-")?"empty-box":id]??.15;
  return Object.fromEntries((two?["left","right"]:["right"]).map(side=>[side,p.clone().add(new THREE.Vector3(two?(side==="left"?width:-width):0,0,0).applyAxisAngle(up,s.player.yaw))]));
 }
 holdPoint(two){return this.robot.localToWorld(new THREE.Vector3(two?0:-.15,.99,.32));}
 plan(p,two,full=false){for(const[side,target]of Object.entries(this.targets(p,two))){const arm=this.arms[side];if(!arm.active)arm.capture();if(full)arm.plan(target);else if(arm.graspPose().position.distanceTo(target)>.015)arm.solve(target,null,4);}}
 error(p,two){return Math.max(...Object.entries(this.targets(p,two)).map(([side,target])=>this.arms[side].graspPose().position.distanceTo(target)));}
 recover(){this.wantCrouch=0;this.wantBend=0;this.phase("recover");for(const[side,arm]of Object.entries(this.arms))if(this.action.rest[side]&&((!this.options.getState().carriedItem&&!this.options.getState().attachment)||(this.action.selected.type==="answer"&&side==="left")))arm.targetAngles=[...this.action.rest[side]];}
 cancel(){
  this.qaDrive=null;this.options.stop();
  if(this.options.getState().attachment){const s=this.options.getState();this.options.setState(this.options.runtime.interact(s));}
  if(this.options.getState().movingFurniture)this.options.setState({...this.options.getState(),movingFurniture:null});
  if(this.action)this.recover();
 }
 commit(){
  const s=this.options.getState(),a=this.action,n=this.options.runtime.interact(s,a.selected);
  this.lastResult={type:a.selected.type,item:a.selected.item,event:n.lastEvent,error:this.error(a.point,a.two),revision:REVISION};
  this.contacts.push(this.lastResult);if(this.contacts.length>60)this.contacts.shift();
  if(n.complete){n.complete=false;n.settling=true;this.pendingCompletion=true;}
  this.options.setState(n);this.options.message(this.options.runtime.eventMessages[n.lastEvent]??"");return n;
 }
 frame(delta,running){
  if(!running)this.options.runtime.resetClock?.();
  if(this.qaPaused){delta=0;running=false;}
  const now=performance.now();this.frames=(this.frames??0)+1;if(!this.fpsStart)this.fpsStart=now;if(now-this.fpsStart>1800){this.fps=this.frames*1000/(now-this.fpsStart);this.frames=0;this.fpsStart=now;}
  const dt=running?Math.min(.05,Math.max(0,delta)):0,s=this.options.getState(),a=this.action;
  // Each rendered pose starts from the authoritative yaw; bending must not accumulate across frames.
  this.robot.quaternion.setFromAxisAngle(up,s.player.yaw);
  this.robot.userData.rackPayload.visible=false;
  if(this.qaDrive){this.qaDrive.remaining-=dt;if(this.qaDrive.remaining<=0){this.qaDrive=null;this.options.stop();}}
  if(["align","move-furniture"].includes(a?.phase)){this.walk.update(dt);this.walk.draw(dt);}
  if(s.attachment&&!a){
   if(!this.pushPrevious)this.pushPrevious={...s.player};
   const d=distance(s.player,this.pushPrevious),turn=Math.abs(s.player.yaw-this.pushPrevious.yaw);this.pushPrevious={...s.player};
   this.pushPhase=(this.pushPhase??0)+(d+turn*.16)*Math.PI*2/.45;
   if(d+turn>.0001){const m=this.robot.userData.officialModel,set=this.robot.userData.robotProfile.setJointAngle;for(const[side,offset]of[["left",0],["right",Math.PI]]){const v=Math.sin(this.pushPhase+offset),lift=Math.max(0,v);set(m,side+"_hip_pitch_link",-.12+v*.18);set(m,side+"_knee_link",.24+lift*.28);set(m,side+"_ankle_pitch_link",-.12-v*.18-lift*.14);}}
  }else this.pushPrevious=null;
  if(a||s.carriedItem||s.attachment||this.crouch||this.bend)this.posture(dt);
  for(const arm of Object.values(this.arms))if(arm.active)arm.apply();
  if(a&&dt){
   a.time+=dt;a.total+=dt;
   if(a.total>55&&a.phase!=="recover"){this.lastResult={type:"timeout",selected:a.selected,phase:a.phase,error:this.error(a.point,a.two)};this.options.message("动作受阻，已停止；请换一侧靠近");this.recover();}
   if(a.phase==="align"&&this.walk.ready){
    for(const[side,arm]of Object.entries(this.arms)){arm.capture();a.rest[side]=[...arm.angles];}
    this.wantCrouch=a.point.y<.18?1:0;this.wantBend=a.selected.type==="grip"?.35:a.point.y<.18?1:1;this.phase("prepare");
   }else if(a.phase==="prepare"&&Math.abs(this.crouch-this.wantCrouch)<.01&&Math.abs(this.bend-this.wantBend)<.01){this.plan(a.point,a.two,true);this.phase("reach");}
   else if(a.phase==="reach"){
    if(a.time>.65&&this.error(a.point,a.two)<.035){
     if(a.selected.type==="answer")this.phase("operate");
     else if(a.selected.type==="prepare"){
      const prep=PREPARATIONS.find(p=>p.id===a.selected.preparation);
      a.moveStart={...this.options.getState().player};a.prep={...prep,...(this.options.getState().furniturePositions?.[prep.id]??{})};
      const s=this.options.getState();this.options.setState({...s,movingFurniture:prep.id,furnitureOrigin:{...s.player},furniturePosition:{x:a.prep.x,z:a.prep.z}});
      this.phase("move-furniture");
      const goal={x:a.stand.x+prep.destination.x-a.prep.x,z:a.stand.z+prep.destination.z-a.prep.z,yaw:a.stand.yaw};
      if(!this.walk.begin(goal,goal.yaw)){this.options.setState({...s,movingFurniture:null});this.recover();}
     }
     else {const n=this.commit();if(n.attachment){this.gripRest=a.rest;this.action=null;this.wantBend=.35;}
      else {this.wantCrouch=0;this.wantBend=0;n.carriedItem?this.phase("lift"):this.recover();}}
    }else if(a.time>2&&a.time-(a.lastPlan??0)>2){this.plan(a.point,a.two,true);a.lastPlan=a.time;}
   }else if(a.phase==="move-furniture"){
    const current=this.options.getState(),dx=current.player.x-a.moveStart.x,dz=current.player.z-a.moveStart.z;
    const root=this.world.preparations[a.prep.id];root.position.set(a.prep.x+dx,0,a.prep.z+dz);
    const target=a.point.clone().add(new THREE.Vector3(dx,0,dz));this.plan(target,true);
    if(this.walk.ready){
     this.options.setState(this.options.runtime.finishFurniture(current,a.prep.id));
     this.lastResult={type:"prepare",item:a.prep.id,event:"clinic_prepared",error:this.error(target,true),revision:REVISION};this.contacts.push(this.lastResult);this.recover();
    }
   }
   else if(a.phase==="operate"){
    this.plan(a.point,a.two);if(a.time>.8&&this.error(a.point,a.two)<.035){this.commit();this.recover();}
   }
   else if(a.phase==="release"&&a.time>.4){this.commit();this.recover();}
   else if(a.phase==="lift"){
    const p=this.holdPoint(a.two),full=a.time>2&&a.time-(a.lastPlan??0)>2;
    this.plan(p,a.two,full);if(full)a.lastPlan=a.time;
    if(a.time>1.2&&this.crouch<.01&&this.bend<.01&&this.error(p,a.two)<.06)this.action=null;
   }else if(a.phase==="recover"){
    if(s.carriedItem)this.plan(this.holdPoint(a.two),a.two,a.time>2&&a.time-(a.lastPlan??0)>2);
    if(a.time-(a.lastPlan??0)>2)a.lastPlan=a.time;
    if(a.time>1.3&&this.crouch<.01&&this.bend<.01){
     if(this.pendingCompletion&&!this.options.getState().failed){this.options.setState({...this.options.getState(),complete:true,settling:false});this.pendingCompletion=false;}
     this.action=null;if(!this.options.getState().carriedItem&&!this.options.getState().attachment)for(const arm of Object.values(this.arms))arm.active=false;
    }
   }
  }
  const state=this.options.getState(),held=state.carriedItem,two=held&&true;
  if(state.attachment&&!this.action)this.plan(new THREE.Vector3(),true);
  else if(held&&!this.action)this.plan(this.holdPoint(two),two);
  for(const arm of Object.values(this.arms))if(arm.active){arm.update(dt);arm.apply();}
  this.heldRoot.visible=Boolean(held);
  if(held){
   const type=held.startsWith("empty-")?"empty-box":held;
   for(const m of this.heldRoot.children)m.visible=m.name===type;
   const p=this.arms.right.graspPose().position.clone();if(two)p.add(this.arms.left.graspPose().position).multiplyScalar(.5);
   p.y-=.11;this.heldRoot.position.copy(p);this.heldRoot.quaternion.setFromAxisAngle(up,state.player.yaw);
   this.robot.userData.robotProfile.setGrip?.(this.robot.userData.officialModel,.55);
  }
  this.qaUpdate?.();
 }
 snapshot(){const s=this.options.getState();return {revision:REVISION,phase:this.action?.phase??(s.attachment?"push":s.carriedItem?"holding":"idle"),selected:this.action?.selected,stand:this.action?.stand,error:this.action?this.error(this.action.point,this.action.two):null,holdError:s.carriedItem?this.error(this.holdPoint(true),true):null,fps:this.fps,robotPose:{position:this.robot.position.toArray(),rotation:this.robot.rotation.toArray().slice(0,3)},lastResult:this.lastResult,contacts:this.contacts,ceiling:this.world.ceiling.visible};}
}
