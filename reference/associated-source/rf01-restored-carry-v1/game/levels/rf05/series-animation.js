import { TISSUE_IDS, reserveTissue, releaseTissueReservation } from "./series-tissues.js";
import { deformTissue } from "./series-tissue-scene.js";
import { taskPoint, windowPoint, animateWindow, WINDOW_CLOSE_DURATION } from "./series-wind.js";
import * as THREE from "three";
import { BrowserArmScript } from "../rf15/browser-arm-script.js";
import { InteractionWalk, approachPath } from "../rf15/interaction-walk.js";
import { REVISION, distance, furniturePoint, standForFurniture } from "./series-layout.js";
export const STOCK_PICKUP_BEND=.55;
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
 reset(){this.action=null;this.readyRest=null;this.readyReturning=0;this.walk?.reset();this.crouch=0;this.bend=0;this.requestedCrouch=0;this.requestedBend=0;this.pendingCompletion=false;this.heldRoot.visible=false;this.lastResult=null;this.contactHistory=[];for(const arm of Object.values(this.arms))arm.active=false;}
 get busy(){const s=this.options.getState();return Boolean(this.action||s.attachment);}
 standFor(s,p,selected){
  if(selected.type==="grip")return approachPath(s,selected.stand,this.options.runtime)?selected.stand:null;
  if(selected.type==="release"||selected.type==="drop")return {...s.player};
  if(selected.type==="window-close"){
   const point=windowPoint({...s.wind,opening:0}),stand={x:point.x-.14,z:point.z+.65,yaw:Math.PI};
   return this.options.runtime.isWalkable(s,stand.x,stand.z)&&approachPath(s,stand,this.options.runtime)?stand:null;
  }
  const candidates=[];
  const faceBin=selected.type==="deliver"&&selected.target==="bin"&&s.items[selected.item]?.type==="tissue";
  // High cart stock must stay inside the verified two-hand reach envelope.
  const stockPickup=selected.type==="pickup"&&s.items[selected.item]?.location==="stock";
  for(const r of(p.y<.16?[.46,.52]:stockPickup?[.46,.54,.62]:[.46,.54,.62,.70,.78]))for(let i=0;i<32;i++){
   const ringYaw=i*Math.PI/16,offset=this.twoHanded(s,selected)?0:.14;
   const x=p.x-Math.sin(ringYaw)*r+Math.cos(ringYaw)*offset,z=p.z-Math.cos(ringYaw)*r-Math.sin(ringYaw)*offset;
   const yaw=faceBin?Math.atan2(p.x-x,p.z-z):ringYaw,stand={x,z,yaw};
   if(!this.options.runtime.isWalkable(s,stand.x,stand.z)||!this.options.runtime.getInteraction({...s,player:stand},selected))continue;
   candidates.push({stand,score:distance(s.player,stand)+r*.25});
  }
  candidates.sort((a,b)=>a.score-b.score);
  for(const c of candidates)if(approachPath(s,c.stand,this.options.runtime))return c.stand;
  return null;
 }
 twoHanded(s,a){return ["grip","release"].includes(a.type)||s.items[a.item??s.carriedItem]?.type==="towel";}
 interact(){
  if(this.action)return true;
  const s=this.options.getState(),selected=this.options.runtime.getInteraction(s);
  if(!selected){this.options.setState(this.options.runtime.interact(s));return true;}
  const invalid=selected.type==="restock"&&(s.items[s.carriedItem].type!==this.options.runtime.slots[selected.slot].type||s.slots[selected.slot])
   ||selected.type==="deliver"&&(s.items[s.carriedItem].type==="tissue"?"bin":{towel:"laundry",cup:"cart",trash:"bin"}[s.carriedItem])!==selected.target;
  if(invalid){const next=this.options.runtime.interact(s,selected);this.options.setState(next);this.options.message(this.options.runtime.eventMessages[next.lastEvent]??"操作条件未满足");return true;}
  const point=new THREE.Vector3(selected.point.x,selected.point.y,selected.point.z);
  if(selected.type==="tissue-catch"){
   const next=reserveTissue(s,selected.item);if(!next)return true;
   this.options.stop();this.options.setState(next);
   this.action={selected,point,stand:{...s.player},phase:"air-reach",time:0,total:0,two:false,rest:{}};
   for(const[side,arm]of Object.entries(this.arms)){arm.capture();this.action.rest[side]=[...arm.angles];}
   this.readyRest=null;this.requestedBend=.45;this.requestedCrouch=point.y<.65?.12:0;this.plan(point,false,true);return true;
  }
  if(["pickup","deliver","restock","drop"].includes(selected.type))point.y+=this.grabHeight(selected.item??s.carriedItem);
  const stand=this.standFor(s,point,selected);
  if(!stand){this.options.message("操作位置被挡住，请从可通行的一侧靠近");return true;}
  this.options.stop();this.action={selected,point,stand,phase:"align",time:0,total:0,two:this.twoHanded(s,selected),rest:{}};
  if(selected.type==="release"){this.phase("release");return true;}
  if(!this.walk.begin(stand,stand.yaw)){this.action=null;return true;}
  this.options.setState({...s,actionTarget:selected.type});
  return true;
 }
 grabHeight(id){const item=this.options.getState().items[id];return item?.type==="cup"?.065:item?.type==="trash"?.06:.05;}
 motionInput(s,input={}){return this.action?.phase==="align"?this.walk.input(s):this.action?idle():s.attachment?input:null;}
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

  const key=s.attachment??(["grip","release"].includes(this.action?.selected.type)?this.action.selected.key:null);
  if(key){const f=s.furniture[key];return Object.fromEntries(["left","right"].map(side=>{const p=furniturePoint(f,side==="left"?f.handleHalfWidth:-f.handleHalfWidth,f.handleY,-f.handleBack);return[side,new THREE.Vector3(p.x,p.y,p.z)];}));}
  return Object.fromEntries((two?["left","right"]:["right"]).map(side=>[side,point.clone().add(new THREE.Vector3((side==="left"?1:-1)*.18,0,0).applyAxisAngle(up,s.player.yaw).multiplyScalar(two?1:0))]));
 }
 holdPoint(two){return this.robot.localToWorld(new THREE.Vector3(two?0:-.15,.96,.32));}
 plan(point,two,full=false){
  const orientation=null;
  for(const[side,target]of Object.entries(this.targets(point,two))){const arm=this.arms[side];if(!arm.active)arm.capture();if(full)arm.plan(target,orientation);else if(arm.graspPose().position.distanceTo(target)>.02)arm.solve(target,orientation,3);}
 }
 error(point,two){return Math.max(...Object.entries(this.targets(point,two)).map(([side,p])=>this.arms[side].graspPose().position.distanceTo(p)));}
 recover(){this.requestedCrouch=0;this.requestedBend=0;this.phase("recover");if(!this.options.getState().carriedItem)for(const[side,arm]of Object.entries(this.arms))if(this.action.rest[side])arm.targetAngles=[...this.action.rest[side]];}
 cancel(){this.options.stop();this.options.setState(releaseTissueReservation(this.options.getState()));if(this.options.getState().attachment){const next=this.options.runtime.interact(this.options.getState());this.options.setState(next);}if(this.action)this.recover();}
 commit(){
  const hand=this.arms.right.graspPose().position,s={...this.options.getState(),catchHand:{x:hand.x,y:hand.y,z:hand.z}},next=this.options.runtime.interact(s,this.action.selected);
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
  if((s.attachment)&&!a){
   if(!this.pushPrevious)this.pushPrevious={...s.player};
   const d=distance(s.player,this.pushPrevious),turn=Math.abs(s.player.yaw-this.pushPrevious.yaw);
   this.pushPhase=(this.pushPhase??0)+(d+turn*.16)*Math.PI*2/.5;this.pushPrevious={...s.player};
   if(d+turn>.0001){const model=this.robot.userData.officialModel,set=this.robot.userData.robotProfile.setJointAngle;for(const[side,offset]of[["left",0],["right",Math.PI]]){const v=Math.sin(this.pushPhase+offset),lift=Math.max(0,v);set(model,side+"_hip_pitch_link",-.12+v*.18);set(model,side+"_knee_link",.24+lift*.28);set(model,side+"_ankle_pitch_link",-.12-v*.18-lift*.14);}}
  }else this.pushPrevious=null;
  if(this.action||s.carriedItem||s.attachment||this.crouch>.001||this.bend>.001)this.posture(dt);for(const arm of Object.values(this.arms))if(arm.active)arm.apply();
  if(a&&dt>0){
   a.time+=dt;a.total+=dt;
   if(a.selected.type==="window-close"&&a.phase!=="task-motion"&&a.phase!=="recover"){
    const p=taskPoint(this.options.getState(),a.selected);a.point.set(p.x,p.y,p.z);
    if(a.phase==="reach")this.plan(a.point,a.two);
   }
   if(a.total>40&&a.phase!=="recover"){this.lastResult={type:"timeout",phase:a.phase,error:this.error(a.point,a.two),point:a.point.toArray(),hand:this.arms.right.graspPose().position.toArray(),stand:a.stand};this.options.message("动作受阻，已停止；可重新靠近操作");const state=this.options.getState();this.options.setState(releaseTissueReservation(state));this.recover();}
   if(a.phase==="align"&&this.walk.ready){
    for(const[side,arm]of Object.entries(this.arms)){arm.capture();a.rest[side]=[...arm.angles];}
    this.requestedCrouch=a.point.y<.18?1:a.point.y<.85?.12:0;
    this.requestedBend=a.selected.type==="window-close"?.45:["grip","release"].includes(a.selected.type)?.35:a.selected.type==="pickup"&&s.items[a.selected.item]?.location==="stock"?STOCK_PICKUP_BEND:1;this.phase("prepare");
   }else if(a.phase==="prepare"&&Math.abs(this.crouch-this.requestedCrouch)<.01&&Math.abs(this.bend-this.requestedBend)<.01){
    this.plan(a.point,a.two,true);this.phase("reach");
   }else if(a.phase==="task-motion"){
    // Move the window/cloth only while the hands have caught up with their contact targets.
    const contact=this.error(a.point,a.two);
    if(contact<.045)a.taskProgress=Math.min(1,a.taskProgress+dt/WINDOW_CLOSE_DURATION);
    const state=structuredClone(this.options.getState());animateWindow(state.wind,a.taskProgress,a.taskFrom);this.options.setState(state);
    const p=taskPoint(this.options.getState(),a.selected);a.point.set(p.x,p.y,p.z);
    this.plan(a.point,a.two,a.time-(a.lastTaskPlan??0)>2);if(a.time-(a.lastTaskPlan??0)>2)a.lastTaskPlan=a.time;
    if(a.taskProgress===1&&this.error(a.point,a.two)<.055){this.commit();this.recover();}
   }else if(a.phase==="air-reach"){
    this.plan(a.point,false,a.time>.7&&a.time-(a.lastAirPlan??0)>.5);
    if(a.time>.7&&a.time-(a.lastAirPlan??0)>.5)a.lastAirPlan=a.time;
    if(a.time>.08&&this.error(a.point,false)<.055){const next=this.commit();if(next){this.requestedBend=0;this.requestedCrouch=0;this.phase("lift");}}
    else if(a.time>1.8){this.options.setState(releaseTissueReservation(this.options.getState()));this.lastResult={type:"miss",event:"tissue_missed",error:this.error(a.point,false),point:a.point.toArray(),hand:this.arms.right.graspPose().position.toArray(),player:this.options.getState().player};this.options.message("纸巾已飘出手边");this.recover();}
   }else if(a.phase==="reach"){
    if(a.time>.65&&this.error(a.point,a.two)<.055){
     if(a.selected.type==="window-close"){
      a.taskFrom={opening:s.wind.opening};
      a.taskProgress=0;this.phase("task-motion");
     }else{
      const next=this.commit();
      if(next){
       if(next.attachment){this.gripRest=a.rest;this.requestedBend=.35;this.requestedCrouch=0;this.action=null;}
       else{this.requestedBend=0;this.requestedCrouch=0;next.carriedItem?this.phase("lift"):this.recover();}
      }
     }
    }else if(a.time>2&&a.time-(a.lastPlan??0)>2){this.plan(a.point,a.two,true);a.lastPlan=a.time;}
   }else if(a.phase==="release"&&a.time>.4){a.rest=this.gripRest??{};this.commit();this.recover();}
   else if(a.phase==="lift"){
    // Re-seed IK after returning upright: a high shelf reach can leave a local minimum.
    const carryPoint=this.holdPoint(a.two);
    if(this.crouch<.01&&this.bend<.01&&a.time>2&&a.time-(a.lastLiftPlan??0)>2&&this.error(carryPoint,a.two)>.065){this.plan(carryPoint,a.two,true);a.lastLiftPlan=a.time;}
    else this.plan(carryPoint,a.two);
    if(this.crouch<.01&&this.bend<.01&&a.time>1.2&&this.error(this.holdPoint(a.two),a.two)<.065){this.action=null;this.options.setState({...this.options.getState(),actionTarget:null});}
   }else if(a.phase==="recover"&&this.crouch<.01&&this.bend<.01&&a.time>1.2){
    const next={...this.options.getState(),actionTarget:null};if(this.pendingCompletion){next.complete=true;next.settling=false;this.pendingCompletion=false;}
    this.options.setState(next);this.action=null;if(!next.carriedItem&&!next.attachment)for(const arm of Object.values(this.arms))arm.active=false;
   }
  }
  const now=this.options.getState(),held=now.carriedItem,two=held&&now.items[held].type==="towel";
  if(!this.action&&!held&&!now.attachment){
   const nearby=TISSUE_IDS.some(id=>{const t=now.items[id];return t&&["air","falling"].includes(t.location)&&distance(now.player,t)<.90&&t.y>.4&&t.y<1.35;});
   if(nearby){
    if(!this.readyRest){this.arms.right.capture();this.readyRest=[...this.arms.right.angles];}
    this.readyReturning=0;this.plan(this.holdPoint(false),false);
   }else if(this.readyRest){
    this.arms.right.targetAngles=[...this.readyRest];this.readyReturning+=dt;
    if(this.readyReturning>.9){this.arms.right.active=false;this.readyRest=null;this.readyReturning=0;}
   }
  }
  if(now.attachment)this.plan(new THREE.Vector3(),true);
  else if(held&&!this.action)this.plan(this.holdPoint(two),two);
  for(const arm of Object.values(this.arms))if(arm.active){arm.update(dt*(this.action?.phase==="air-reach"?4:1));arm.apply();}
  this.heldRoot.visible=Boolean(held);
  if(held){
   for(const m of this.heldRoot.children){m.visible=m.name===held;if(m.visible&&now.items[held].type==="tissue")deformTissue(m,{...now.items[held],clock:now.wind.clock});}
   const p=this.arms.right.graspPose().position.clone();if(two)p.add(this.arms.left.graspPose().position).multiplyScalar(.5);
   p.y-=this.grabHeight(held);this.heldRoot.position.copy(p);this.heldRoot.quaternion.setFromAxisAngle(up,now.player.yaw);
   this.robot.userData.robotProfile?.setGrip?.(this.robot.userData.officialModel,.55);
  }

  const hand=this.arms.right.graspPose().position;this.options.setState({...this.options.getState(),catchHand:{x:hand.x,y:hand.y,z:hand.z}});
  if(this.qa)document.querySelector("#game-shell").dataset.hotelAnimation=JSON.stringify(this.snapshot());
 }
 snapshot(){const s=this.options.getState(),a=this.action;return {revision:REVISION,fps:this.fps,gripError:s.attachment?this.error(new THREE.Vector3(),true):null,phase:a?.phase??(s.attachment?"push":s.carriedItem?"holding":"idle"),selected:a?.selected,stand:a?.stand,error:a?this.error(a.point,a.two):null,hand:this.arms.right.graspPose().position.toArray(),held:this.heldRoot.position.toArray(),player:s.player,wind:s.wind,tissues:Object.fromEntries(TISSUE_IDS.filter(id=>s.items[id]).map(id=>[id,s.items[id]])),catchHand:s.catchHand,lastResult:this.lastResult,contacts:this.contactHistory};}
}
