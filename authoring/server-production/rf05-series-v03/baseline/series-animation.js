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
 reset(){this.action=null;this.walk?.reset();this.crouch=0;this.bend=0;this.requestedCrouch=0;this.requestedBend=0;this.pendingCompletion=false;this.heldRoot.visible=false;this.lastResult=null;this.contactHistory=[];for(const arm of Object.values(this.arms))arm.active=false;}
 get busy(){return Boolean(this.action||this.options.getState().attachment);}
 standFor(s,p,selected){
  if(selected.type==="grip")return approachPath(s,selected.stand,this.options.runtime)?selected.stand:null;
  if(selected.type==="release"||selected.type==="drop")return {...s.player};
  const candidates=[];
  for(const r of(["sink-place","sink-take","wash"].includes(selected.type)?[.50,.54,.58]:p.y<.16?[.46,.52]:[.46,.54,.62,.70,.78]))for(let i=0;i<32;i++){
   const yaw=i*Math.PI/16,offset=this.twoHanded(s,selected)?0:.14,stand={x:p.x-Math.sin(yaw)*r+Math.cos(yaw)*offset,z:p.z-Math.cos(yaw)*r-Math.sin(yaw)*offset,yaw};
   if(!this.options.runtime.isWalkable(s,stand.x,stand.z)||!this.options.runtime.getInteraction({...s,player:stand},selected))continue;
   candidates.push({stand,score:distance(s.player,stand)+r*(["sink-place","sink-take","wash"].includes(selected.type)?2:.25)});
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
  const invalid=selected.type==="wash"&&(s.sink.faucet||s.sink.draining||s.sink.water<.4||s.sink.water>.7)
   ||selected.type==="restock"&&(s.items[s.carriedItem].type!==this.options.runtime.slots[selected.slot].type||s.slots[selected.slot])
   ||selected.type==="deliver"&&{towel:"laundry",cup:"cart",trash:"bin"}[s.carriedItem]!==selected.target;
  if(invalid){const next=this.options.runtime.interact(s,selected);this.options.setState(next);this.options.message(this.options.runtime.eventMessages[next.lastEvent]??"操作条件未满足");return true;}
  const point=new THREE.Vector3(selected.point.x,selected.point.y,selected.point.z);
  if(["pickup","sink-take","deliver","restock","sink-place","drop"].includes(selected.type))point.y+=this.grabHeight(selected.item??s.carriedItem);
  if(selected.type==="wash")point.y+=.11;
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
  const s=this.options.getState(),key=s.attachment??(["grip","release"].includes(this.action?.selected.type)?this.action.selected.key:null);
  if(key){const f=s.furniture[key];return Object.fromEntries(["left","right"].map(side=>{const p=furniturePoint(f,side==="left"?f.handleHalfWidth:-f.handleHalfWidth,f.handleY,-f.handleBack);return[side,new THREE.Vector3(p.x,p.y,p.z)];}));}
  return Object.fromEntries((two?["left","right"]:["right"]).map(side=>[side,point.clone().add(new THREE.Vector3(side==="left"?.18:-.18,0,0).applyAxisAngle(up,s.player.yaw).multiplyScalar(two?1:0))]));
 }
 holdPoint(two){return this.robot.localToWorld(new THREE.Vector3(two?0:-.15,.96,.32));}
 plan(point,two,full=false){
  const a=this.action,basin=a&&["sink-place","sink-take","wash"].includes(a.selected.type)&&!["lift","recover"].includes(a.phase);
  let orientation=null;
  if(basin){const yaw=this.options.getState().player.yaw,down=new THREE.Vector3(0,-1,0),side=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));orientation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(down,side,new THREE.Vector3().crossVectors(down,side)));}
  for(const[side,target]of Object.entries(this.targets(point,two))){const arm=this.arms[side];if(!arm.active)arm.capture();if(full)arm.plan(target,orientation);else if(arm.graspPose().position.distanceTo(target)>.02)arm.solve(target,orientation,3);}
 }
 error(point,two){return Math.max(...Object.entries(this.targets(point,two)).map(([side,p])=>this.arms[side].graspPose().position.distanceTo(p)));}
 recover(){this.requestedCrouch=0;this.requestedBend=0;this.phase("recover");if(!this.options.getState().carriedItem)for(const[side,arm]of Object.entries(this.arms))if(this.action.rest[side])arm.targetAngles=[...this.action.rest[side]];}
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
  if(s.attachment&&!a){
   if(!this.pushPrevious)this.pushPrevious={...s.player};
   const d=distance(s.player,this.pushPrevious),turn=Math.abs(s.player.yaw-this.pushPrevious.yaw);
   this.pushPhase=(this.pushPhase??0)+(d+turn*.16)*Math.PI*2/.5;this.pushPrevious={...s.player};
   if(d+turn>.0001){const model=this.robot.userData.officialModel,set=this.robot.userData.robotProfile.setJointAngle;for(const[side,offset]of[["left",0],["right",Math.PI]]){const v=Math.sin(this.pushPhase+offset),lift=Math.max(0,v);set(model,side+"_hip_pitch_link",-.12+v*.18);set(model,side+"_knee_link",.24+lift*.28);set(model,side+"_ankle_pitch_link",-.12-v*.18-lift*.14);}}
  }else this.pushPrevious=null;
  if(this.action||s.carriedItem||s.attachment||this.crouch>.001||this.bend>.001)this.posture(dt);for(const arm of Object.values(this.arms))if(arm.active)arm.apply();
  if(a&&dt>0){
   a.time+=dt;a.total+=dt;
   if(a.total>40&&a.phase!=="recover"){this.lastResult={type:"timeout",phase:a.phase,error:this.error(a.point,a.two),point:a.point.toArray(),hand:this.arms.right.graspPose().position.toArray(),stand:a.stand};this.options.message("动作受阻，已停止；可重新靠近操作");this.recover();}
   if(a.phase==="align"&&this.walk.ready){
    for(const[side,arm]of Object.entries(this.arms)){arm.capture();a.rest[side]=[...arm.angles];}
    this.requestedCrouch=["sink-place","sink-take","wash"].includes(a.selected.type)?0:a.point.y<.18?1:a.point.y<.85?.12:0;this.requestedBend=["sink-place","sink-take","wash"].includes(a.selected.type)?.65:["grip","release"].includes(a.selected.type)?.35:1;this.phase("prepare");
   }else if(a.phase==="prepare"&&Math.abs(this.crouch-this.requestedCrouch)<.01&&Math.abs(this.bend-this.requestedBend)<.01){if(["sink-place","sink-take","wash"].includes(a.selected.type)){this.plan(a.point.clone().setY(1.08),a.two,true);this.phase("over-basin");}else{this.plan(a.point,a.two,true);this.phase("reach");}}
   else if(a.phase==="over-basin"){
    const top=a.point.clone().setY(1.08);
    if(a.time>2&&a.time-(a.lastBasinPlan??0)>2&&this.error(top,a.two)>.06){this.plan(top,a.two,true);a.lastBasinPlan=a.time;}else this.plan(top,a.two);
    if(a.time>.8&&this.error(top,a.two)<.055){this.plan(a.point,a.two,true);this.phase("reach");}
   }else if(a.phase==="withdraw"){
    const top=a.point.clone().setY(1.08);
    if(a.time>2&&a.time-(a.lastBasinPlan??0)>2&&this.error(top,a.two)>.06){this.plan(top,a.two,true);a.lastBasinPlan=a.time;}else this.plan(top,a.two);
    if(a.time>.7&&this.error(top,a.two)<.06)this.recover();
   }else if(a.phase==="basin-lift"){
    const top=a.point.clone().setY(1.08);
    if(a.time>2&&a.time-(a.lastBasinPlan??0)>2&&this.error(top,a.two)>.06){this.plan(top,a.two,true);a.lastBasinPlan=a.time;}else this.plan(top,a.two);
    if(a.time>.7&&this.error(top,a.two)<.06){this.requestedBend=0;this.requestedCrouch=0;this.phase("lift");}
   }else if(a.phase==="reach"){
    if(a.time>.65&&this.error(a.point,a.two)<.055){
     if(a.selected.type==="wash")this.phase("wash");
     else{const next=this.commit();if(next){if(next.attachment){this.gripRest=a.rest;this.requestedBend=.35;this.requestedCrouch=0;this.action=null;}else{this.requestedBend=0;this.requestedCrouch=0;if(a.selected.type==="sink-take"){this.requestedBend=.65;this.phase("basin-lift");}else if(a.selected.type==="sink-place"){this.requestedBend=.65;this.phase("withdraw");}else next.carriedItem?this.phase("lift"):this.recover();}}}
    }else if(a.time>2&&a.time-(a.lastPlan??0)>2){this.plan(a.point,a.two,true);a.lastPlan=a.time;}
   }else if(a.phase==="wash"){
    const p=a.point.clone().add(new THREE.Vector3(Math.sin(a.time*6)*.025,Math.sin(a.time*3)*.02,Math.cos(a.time*6)*.025));this.plan(p,false);
    if(a.time>=3.2){this.commit();this.phase("withdraw");}
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
  if(now.attachment)this.plan(new THREE.Vector3(),true);
  else if(held&&!this.action)this.plan(this.holdPoint(two),two);
  for(const arm of Object.values(this.arms))if(arm.active){arm.update(dt);arm.apply();}
  this.heldRoot.visible=Boolean(held);
  if(held){
   for(const m of this.heldRoot.children)m.visible=m.name===held;
   const p=this.arms.right.graspPose().position.clone();if(two)p.add(this.arms.left.graspPose().position).multiplyScalar(.5);
   p.y-=this.grabHeight(held);this.heldRoot.position.copy(p);this.heldRoot.quaternion.setFromAxisAngle(up,now.player.yaw);
   this.robot.userData.robotProfile?.setGrip?.(this.robot.userData.officialModel,.55);
  }
  if(this.qa)document.querySelector("#game-shell").dataset.hotelAnimation=JSON.stringify(this.snapshot());
 }
 snapshot(){const s=this.options.getState(),a=this.action;return {revision:REVISION,fps:this.fps,gripError:s.attachment?this.error(new THREE.Vector3(),true):null,phase:a?.phase??(s.attachment?"push":s.carriedItem?"holding":"idle"),selected:a?.selected,stand:a?.stand,error:a?this.error(a.point,a.two):null,hand:this.arms.right.graspPose().position.toArray(),held:this.heldRoot.position.toArray(),player:s.player,lastResult:this.lastResult,contacts:this.contactHistory};}
}
