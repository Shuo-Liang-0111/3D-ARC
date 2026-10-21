import { WETROOM, toolPose, toolGrip, toolPoint } from "./series-leak.js";
import { setSqueegeePose } from "./series-leak-scene.js";
import * as THREE from "three";
import { BrowserArmScript } from "../rf15/browser-arm-script.js";
import { InteractionWalk, approachPath } from "../rf15/interaction-walk.js";
import { REVISION, distance, furniturePoint, standForFurniture } from "./series-layout.js";
const up=new THREE.Vector3(0,1,0),idle=()=>({move:0,strafe:0,turn:0,drain:false});
export function createHotelAnimation(world,robot,options){if(!robot.userData.officialModel?.getObjectByName("right_shoulder_pitch_link"))return null;return new HotelAnimation(world,robot,options);}
class HotelAnimation{
 constructor(world,robot,options){
  this.world=world;this.robot=robot;this.options=options;this.arms={};
  for(const side of ["left","right"])this.arms[side]=new BrowserArmScript(robot,side);
  this.walk=new InteractionWalk(this);this.heldRoot=new THREE.Group();world.scene.add(this.heldRoot);
  for(const[id,template]of Object.entries(world.carryTemplates)){const m=template.clone(true);m.name=id;m.position.set(0,0,0);m.rotation.set(0,0,0);m.visible=false;this.heldRoot.add(m);}
  this.reset();world.hotelController=this;
  if(new URLSearchParams(location.search).get("rf05qa")==="1")import("./series-qa.js").then(m=>m.installHotelQA(this));
 }
 reset(){this.action=null;this.toolTargetPose=null;this.walk?.reset();this.crouch=0;this.bend=0;this.requestedCrouch=0;this.requestedBend=0;this.pendingCompletion=false;this.heldRoot.visible=false;this.lastResult=null;this.contactHistory=[];for(const arm of Object.values(this.arms))arm.active=false;}
 get busy(){const s=this.options.getState();return Boolean(this.action||s.attachment||s.tool.held);}
 standFor(s,p,selected){
  if(selected.type==="grip")return approachPath(s,selected.stand,this.options.runtime)?selected.stand:null;
  if(selected.type==="release"||selected.type==="drop")return {...s.player};
  const candidates=[];
  for(const r of(["tool-take","tool-return"].includes(selected.type)?[.38,.40]:p.y<.16?[.46,.52]:[.46,.54,.62,.70,.78]))for(let i=0;i<32;i++){
   const yaw=i*Math.PI/16,offset=this.twoHanded(s,selected)?0:.14,stand={x:p.x-Math.sin(yaw)*r+Math.cos(yaw)*offset,z:p.z-Math.cos(yaw)*r-Math.sin(yaw)*offset,yaw};
   if(!this.options.runtime.isWalkable(s,stand.x,stand.z)||!this.options.runtime.getInteraction({...s,player:stand},selected))continue;
   candidates.push({stand,score:distance(s.player,stand)+r*(["tool-take","tool-return"].includes(selected.type)?2:.25)});
  }
  candidates.sort((a,b)=>a.score-b.score);
  for(const c of candidates)if(approachPath(s,c.stand,this.options.runtime))return c.stand;
  return null;
 }
 twoHanded(s,a){return ["grip","release","tool-take","tool-return"].includes(a.type)||s.items[a.item??s.carriedItem]?.type==="towel";}
 interact(){
  if(this.action)return true;
  const s=this.options.getState(),selected=this.options.runtime.getInteraction(s);
  if(!selected){this.options.setState(this.options.runtime.interact(s));return true;}
  const invalid=selected.type==="tool-return-blocked"
   ||selected.type==="restock"&&(s.items[s.carriedItem].type!==this.options.runtime.slots[selected.slot].type||s.slots[selected.slot])
   ||selected.type==="deliver"&&{towel:"laundry",cup:"cart",trash:"bin"}[s.carriedItem]!==selected.target;
  if(invalid){const next=this.options.runtime.interact(s,selected);this.options.setState(next);this.options.message(this.options.runtime.eventMessages[next.lastEvent]??"操作条件未满足");return true;}
  const point=new THREE.Vector3(selected.point.x,selected.point.y,selected.point.z);
  if(["pickup","deliver","restock","drop"].includes(selected.type))point.y+=this.grabHeight(selected.item??s.carriedItem);
  const stand=this.standFor(s,point,selected);
  if(!stand){this.options.message("操作位置被挡住，请从可通行的一侧靠近");return true;}
  this.options.stop();this.action={selected,point,stand,phase:"align",time:0,total:0,two:this.twoHanded(s,selected),rest:{}};
  this.toolTargetPose=selected.type==="tool-take"?toolPose(s):null;
  if(selected.type==="release"){this.phase("release");return true;}
  if(!this.walk.begin(stand,stand.yaw)){this.action=null;return true;}
  this.options.setState({...s,actionTarget:selected.type});
  return true;
 }
 grabHeight(id){const item=this.options.getState().items[id];return item?.type==="cup"?.065:item?.type==="trash"?.06:.05;}
 motionInput(s,input={}){return this.action?.phase==="align"?this.walk.input(s):this.action?idle():s.attachment||s.tool.held?input:null;}
 phase(p){this.action.phase=p;this.action.time=0;}
 posture(dt){
  this.crouch+=THREE.MathUtils.clamp(this.requestedCrouch-this.crouch,-dt*.65,dt*.65);this.bend+=THREE.MathUtils.clamp(this.requestedBend-this.bend,-dt*.9,dt*.9);
  const model=this.robot.userData.officialModel,set=this.robot.userData.robotProfile.setJointAngle;
  const feet=["left","right"].map(side=>model.getObjectByName(side+"_ankle_roll_link"));
  const center=()=>feet.reduce((v,f)=>v.add(f.getWorldPosition(new THREE.Vector3())),new THREE.Vector3()).multiplyScalar(.5);
  this.robot.updateMatrixWorld(true);const before=center();
  if(this.crouch>.001){const knee=this.crouch*2.7,ankle=-this.crouch*.87;for(const side of ["left","right"]){set(model,side+"_hip_pitch_link",-knee-ankle);set(model,side+"_knee_link",knee);set(model,side+"_ankle_pitch_link",ankle);}}
  const ground=this.action?.point.y<.18;
  this.robot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),this.bend*(ground||this.action&&distance(this.action.stand,this.action.point)>.70?.5:.25)));
  set(model,"torso_link",.25+this.bend*(ground?.85:.45));this.robot.updateMatrixWorld(true);
  if(this.bend>.001||this.crouch>.001)this.robot.position.add(before.sub(center()));this.robot.updateMatrixWorld(true);
 }
 targets(point,two){
  const s=this.options.getState();
  if(s.tool.held||["tool-take","tool-return"].includes(this.action?.selected.type)){const pose=this.toolTargetPose??toolPose(s);return Object.fromEntries(["left","right"].map(side=>{const p=toolGrip(pose,side);return [side,new THREE.Vector3(p.x,p.y,p.z)];}));}
  const key=s.attachment??(["grip","release"].includes(this.action?.selected.type)?this.action.selected.key:null);
  if(key){const f=s.furniture[key];return Object.fromEntries(["left","right"].map(side=>{const p=furniturePoint(f,side==="left"?f.handleHalfWidth:-f.handleHalfWidth,f.handleY,-f.handleBack);return[side,new THREE.Vector3(p.x,p.y,p.z)];}));}
  return Object.fromEntries((two?["left","right"]:["right"]).map(side=>[side,point.clone().add(new THREE.Vector3(side==="left"?.18:-.18,0,0).applyAxisAngle(up,s.player.yaw).multiplyScalar(two?1:0))]));
 }
 holdPoint(two){return this.robot.localToWorld(new THREE.Vector3(two?0:-.15,.96,.32));}
 plan(point,two,full=false){
  const orientation=null;
  for(const[side,target]of Object.entries(this.targets(point,two))){const arm=this.arms[side];if(!arm.active)arm.capture();if(full)arm.plan(target,orientation);else if(arm.graspPose().position.distanceTo(target)>.02)arm.solve(target,orientation,3);}
 }
 error(point,two){return Math.max(...Object.entries(this.targets(point,two)).map(([side,p])=>this.arms[side].graspPose().position.distanceTo(p)));}
 recover(){this.requestedCrouch=0;this.requestedBend=0;this.phase("recover");if(!this.options.getState().carriedItem&&!this.options.getState().tool.held)for(const[side,arm]of Object.entries(this.arms))if(this.action.rest[side])arm.targetAngles=[...this.action.rest[side]];}
 cancel(){this.options.stop();if(this.options.getState().attachment){const next=this.options.runtime.interact(this.options.getState());this.options.setState(next);}if(this.action)this.recover();}
 commit(){
  const s=this.options.getState(),next=this.options.runtime.interact(s,this.action.selected);
  if(next.interactions===s.interactions){this.lastResult={type:"rejected",event:next.lastEvent};this.recover();return null;}
  const error=this.error(this.action.point,this.action.two);this.lastResult={type:this.action.selected.type,event:next.lastEvent,error,revision:REVISION};
  this.contactHistory.push(this.lastResult);if(this.contactHistory.length>40)this.contactHistory.shift();
  if(next.complete){next.complete=false;next.settling=true;this.pendingCompletion=true;}
  this.options.setState(next);this.options.message(this.options.runtime.eventMessages[next.lastEvent]??"");
  return next;
 }
 frame(delta,running){
  this.frames=(this.frames??0)+1;const wall=performance.now();if(!this.fpsStart)this.fpsStart=wall;if(wall-this.fpsStart>1500){this.fps=this.frames*1000/(wall-this.fpsStart);this.frames=0;this.fpsStart=wall;}
  const dt=running?Math.min(.05,Math.max(0,delta)):0,s=this.options.getState(),a=this.action;this.robot.userData.rackPayload.visible=false;
  if(a?.phase==="align"){this.walk.update(dt);this.walk.draw(dt);}
  if((s.attachment||s.tool.held)&&!a){
   if(!this.pushPrevious)this.pushPrevious={...s.player};
   const d=distance(s.player,this.pushPrevious),turn=Math.abs(s.player.yaw-this.pushPrevious.yaw);
   this.pushPhase=(this.pushPhase??0)+(d+turn*.16)*Math.PI*2/.5;this.pushPrevious={...s.player};
   if(d+turn>.0001){const model=this.robot.userData.officialModel,set=this.robot.userData.robotProfile.setJointAngle;for(const[side,offset]of[["left",0],["right",Math.PI]]){const v=Math.sin(this.pushPhase+offset),lift=Math.max(0,v);set(model,side+"_hip_pitch_link",-.12+v*.18);set(model,side+"_knee_link",.24+lift*.28);set(model,side+"_ankle_pitch_link",-.12-v*.18-lift*.14);}}
  }else this.pushPrevious=null;
  if(this.action||s.carriedItem||s.attachment||s.tool.held||this.crouch>.001||this.bend>.001)this.posture(dt);for(const arm of Object.values(this.arms))if(arm.active)arm.apply();
  if(a&&dt>0){
   a.time+=dt;a.total+=dt;
   if(a.total>40&&a.phase!=="recover"){this.lastResult={type:"timeout",phase:a.phase,error:this.error(a.point,a.two),point:a.point.toArray(),hand:this.arms.right.graspPose().position.toArray(),stand:a.stand};this.options.message("动作受阻，已停止；可重新靠近操作");this.recover();}
   if(a.phase==="align"&&this.walk.ready){
    for(const[side,arm]of Object.entries(this.arms)){arm.capture();a.rest[side]=[...arm.angles];}
    const tool=["tool-take","tool-return"].includes(a.selected.type);
    this.requestedCrouch=tool?0:a.point.y<.18?1:a.point.y<.85?.12:0;
    this.requestedBend=tool?.40:["grip","release"].includes(a.selected.type)?.35:1;this.phase("prepare");
   }else if(a.phase==="prepare"&&Math.abs(this.crouch-this.requestedCrouch)<.01&&Math.abs(this.bend-this.requestedBend)<.01){
    if(a.selected.type==="tool-return"){a.toolFrom=toolPose(this.options.getState());this.phase("tool-return-transfer");}
    else{this.plan(a.point,a.two,true);this.phase("reach");}
   }else if(a.phase==="tool-transfer"||a.phase==="tool-return-transfer"){
    const target=a.phase==="tool-transfer"?toolPose(this.options.getState()):WETROOM.toolHome;
    const t=Math.min(1,a.time/1.4),u=t*t*(3-2*t),from=a.toolFrom;
    const yawDelta=Math.atan2(Math.sin(target.yaw-from.yaw),Math.cos(target.yaw-from.yaw));
    this.toolTargetPose={x:THREE.MathUtils.lerp(from.x,target.x,u),y:THREE.MathUtils.lerp(from.y,target.y,u)+Math.sin(Math.PI*u)*.13,z:THREE.MathUtils.lerp(from.z,target.z,u),yaw:from.yaw+yawDelta*u,tilt:THREE.MathUtils.lerp(from.tilt,target.tilt,u),roll:THREE.MathUtils.lerp(from.roll??0,target.roll??0,u)};
    this.plan(a.point,true,a.time-(a.lastToolPlan??-2)>2);
    if(a.time-(a.lastToolPlan??-2)>2)a.lastToolPlan=a.time;
    if(t===1&&this.error(a.point,true)<.055){
     if(a.phase==="tool-transfer"){this.toolTargetPose=null;this.action=null;this.options.setState({...this.options.getState(),actionTarget:null});}
     else{this.commit();this.toolTargetPose=null;this.recover();}
    }
   }else if(a.phase==="reach"){
    if(a.time>.65&&this.error(a.point,a.two)<.055){
     if(a.selected.type==="valve")this.phase("turn-valve");
     else{
      const fromTool=a.selected.type==="tool-take"?toolPose(this.options.getState()):null,next=this.commit();
      if(next){
       if(next.tool.held){a.toolFrom=fromTool;this.requestedBend=.40;this.phase("tool-transfer");}
       else if(next.attachment){this.gripRest=a.rest;this.requestedBend=.35;this.requestedCrouch=0;this.action=null;}
       else{this.requestedBend=0;this.requestedCrouch=0;next.carriedItem?this.phase("lift"):this.recover();}
      }
     }
    }else if(a.time>2&&a.time-(a.lastPlan??0)>2){this.plan(a.point,a.two,true);a.lastPlan=a.time;}
   }else if(a.phase==="turn-valve"){
    this.plan(a.point.clone().add(new THREE.Vector3(Math.sin(a.time*3)*.025,Math.cos(a.time*3)*.02,0)),false);
    if(a.time>=.8){this.commit();this.recover();}
   }else if(a.phase==="release"&&a.time>.4){a.rest=this.gripRest??{};this.commit();this.recover();}
   else if(a.phase==="lift"){
    // Re-seed IK after returning upright: a high shelf reach can leave a local minimum.
    const carryPoint=this.holdPoint(a.two);
    if(this.crouch<.01&&this.bend<.01&&a.time>2&&a.time-(a.lastLiftPlan??0)>2&&this.error(carryPoint,a.two)>.065){this.plan(carryPoint,a.two,true);a.lastLiftPlan=a.time;}
    else this.plan(carryPoint,a.two);
    if(this.crouch<.01&&this.bend<.01&&a.time>1.2&&this.error(this.holdPoint(a.two),a.two)<.065){this.action=null;this.options.setState({...this.options.getState(),actionTarget:null});}
   }else if(a.phase==="recover"&&this.crouch<.01&&this.bend<.01&&a.time>1.2){
    const next={...this.options.getState(),actionTarget:null};if(this.pendingCompletion){next.complete=true;next.settling=false;this.pendingCompletion=false;}
    this.options.setState(next);this.action=null;if(!next.carriedItem&&!next.attachment&&!next.tool.held)for(const arm of Object.values(this.arms))arm.active=false;
   }
  }
  const now=this.options.getState(),held=now.carriedItem,two=held&&now.items[held].type==="towel";
  if(now.tool.held&&!this.action)this.plan(new THREE.Vector3(),true);
  else if(now.attachment)this.plan(new THREE.Vector3(),true);
  else if(held&&!this.action)this.plan(this.holdPoint(two),two);
  for(const arm of Object.values(this.arms))if(arm.active){arm.update(dt);arm.apply();}
  this.heldRoot.visible=Boolean(held);
  if(held){
   for(const m of this.heldRoot.children)m.visible=m.name===held;
   const p=this.arms.right.graspPose().position.clone();if(two)p.add(this.arms.left.graspPose().position).multiplyScalar(.5);
   p.y-=this.grabHeight(held);this.heldRoot.position.copy(p);this.heldRoot.quaternion.setFromAxisAngle(up,now.player.yaw);
   this.robot.userData.robotProfile?.setGrip?.(this.robot.userData.officialModel,.55);
  }
  if(now.tool.held||this.toolTargetPose){setSqueegeePose(this.world.leakScene.tool,this.toolTargetPose??toolPose(now));this.robot.userData.robotProfile?.setGrip?.(this.robot.userData.officialModel,.68);}
  if(this.qa)document.querySelector("#game-shell").dataset.hotelAnimation=JSON.stringify(this.snapshot());
 }
 snapshot(){const s=this.options.getState(),a=this.action;return {revision:REVISION,fps:this.fps,gripError:s.attachment||s.tool.held?this.error(new THREE.Vector3(),true):null,phase:a?.phase??(s.tool.held?"squeegee":s.attachment?"push":s.carriedItem?"holding":"idle"),selected:a?.selected,stand:a?.stand,error:a?this.error(a.point,a.two):null,hand:this.arms.right.graspPose().position.toArray(),held:this.heldRoot.position.toArray(),player:s.player,tool:s.tool,water:s.leak.parcels.reduce((n,p)=>n+p.amount,0),leakOpen:s.leak.open,lastResult:this.lastResult,contacts:this.contactHistory};}
}
