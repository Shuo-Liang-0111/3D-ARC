import * as THREE from "three";
import {BrowserArmScript} from "../rf15/browser-arm-script.js";
import {InteractionWalk,approachPath} from "../rf15/interaction-walk.js";
import {distance,REVISION} from "./series-engine.js";
import {gripHeight} from "./series-scene.js";
const up=new THREE.Vector3(0,1,0),idle=()=>({move:0,strafe:0,turn:0,drain:false});
export function createSeriesAnimation(world,robot,options){return new SeriesAnimation(world,robot,options);}
export class SeriesAnimation{
 constructor(world,robot,options){
  this.world=world;this.robot=robot;this.options=options;this.arm=new BrowserArmScript(robot,"right");this.walk=new InteractionWalk(this);
  this.heldRoot=new THREE.Group();world.scene.add(this.heldRoot);this.templates={};
  for(const [k,root]of Object.entries(world.assetRoots.items)){const m=root.clone(true);m.position.set(0,0,0);m.rotation.set(0,0,0);m.visible=false;this.heldRoot.add(m);this.templates[k]=m;}
  world.controller=this;this.reset();
  if(new URLSearchParams(location.search).get("rf07qa")==="1")import("./series-qa.js").then(m=>m.installQA(this));
 }
 reset(){this.action=null;this.arm.active=false;this.walk.reset();this.crouch=0;this.bend=0;this.desiredCrouch=0;this.desiredBend=0;this.heldRoot.visible=false;this.contacts=[];this.lastResult=null;}
 get busy(){return Boolean(this.action);}
 standFor(s,a){
  if(a.type==='cabinet'&&a.cabinet==='cold-02')s={...s,doorOpen:true};
  const p=a.point,candidates=[];
  for(const radius of (p.y<.6?[.38,.42,.46]:[.46,.52,.60]))for(let i=0;i<48;i++){const yaw=i*Math.PI/24,stand={x:p.x-Math.sin(yaw)*radius+Math.cos(yaw)*.12,z:p.z-Math.cos(yaw)*radius-Math.sin(yaw)*.12,yaw};
   if(this.options.runtime.isWalkable(s,stand.x,stand.z))candidates.push({stand,score:distance(s.player,stand)*.25+radius});}
  candidates.sort((a,b)=>a.score-b.score);return candidates.find(c=>approachPath(s,c.stand,this.options.runtime))?.stand;
 }
 interact(){
  if(this.action)return true;
  const s=this.options.getState(),a=this.options.runtime.getInteraction(s);
  if(!a)return true;
  if(a.blocked){const next=this.options.runtime.interact(s);this.options.setState(next);this.options.message(this.options.runtime.eventMessages[next.lastEvent]);return true;}
  const stand=this.standFor(s,a);if(!stand){this.options.message("操作位置被遮挡，请从开口侧靠近");return true;}
  if(a.type==='cabinet'&&a.cabinet==='cold-02')this.options.setState({...s,doorOpen:true});
  this.options.stop();this.action={selected:a,point:new THREE.Vector3(a.point.x,a.point.y,a.point.z),stand,phase:"align",time:0,total:0,original:s.carriedItem,committed:false};
  if(!this.walk.begin(stand,stand.yaw))this.action=null;return true;
 }
 motionInput(s){return this.action?.phase==="align"?this.walk.input(s):this.action?idle():null;}
 phase(p){this.action.phase=p;this.action.time=0;}
 cancel(){if(this.action){this.desiredBend=0;this.desiredCrouch=0;this.phase("recover");}}
 posture(dt){
  this.crouch+=THREE.MathUtils.clamp(this.desiredCrouch-this.crouch,-dt*.7,dt*.7);
  this.bend+=THREE.MathUtils.clamp(this.desiredBend-this.bend,-dt,dt);
  const m=this.robot.userData.officialModel,set=this.robot.userData.robotProfile.setJointAngle;
  const feet=["left","right"].map(s=>m.getObjectByName(s+"_ankle_roll_link"));
  const center=()=>feet.reduce((v,f)=>v.add(f.getWorldPosition(new THREE.Vector3())),new THREE.Vector3()).multiplyScalar(.5);
  this.robot.updateMatrixWorld(true);const before=center();
  if(this.crouch>.001)for(const s of ["left","right"]){const k=this.crouch*2.7,a=-this.crouch*.87;set(m,s+"_hip_pitch_link",-k-a);set(m,s+"_knee_link",k);set(m,s+"_ankle_pitch_link",a);}
  this.robot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),this.bend*(this.action?.point.y<.18?.5:.25)));
  set(m,"torso_link",.25+this.bend*(this.action?.point.y<.18?.85:.45));this.robot.updateMatrixWorld(true);
  if(this.bend>.001||this.crouch>.001)this.robot.position.add(before.sub(center()));this.robot.updateMatrixWorld(true);
 }
 holdPoint(){return this.robot.localToWorld(new THREE.Vector3(-.18,1.02,.32));}
 target(p,full=false){if(!this.arm.active)this.arm.capture();if(full)this.arm.plan(p);else this.arm.solve(p,null,4);}
 recover(){this.desiredCrouch=0;this.desiredBend=0;this.phase("recover");if(!this.options.getState().carriedItem&&this.action.rest)this.arm.targetAngles=[...this.action.rest];}
 commit(){
  const a=this.action,s=this.options.getState(),next=this.options.runtime.interact(s,a.selected);
  a.committed=true;this.lastResult={type:a.selected.type,event:next.lastEvent,error:this.arm.graspPose().position.distanceTo(a.point),revision:REVISION};
  this.contacts.push(this.lastResult);
  if(next.complete){next.complete=false;next.settling=true;a.complete=true;}
  this.options.setState(next);this.options.message(this.options.runtime.eventMessages[next.lastEvent]??"");return next;
 }
 frame(delta,running){
  this.frames=(this.frames??0)+1;const nowMs=performance.now();if(!this.fpsStart)this.fpsStart=nowMs;if(nowMs-this.fpsStart>2000){this.fps=this.frames*1000/(nowMs-this.fpsStart);this.frames=0;this.fpsStart=nowMs;}
  if(this.options.getState().failed&&this.action){this.action=null;this.arm.active=false;this.walk.reset();}
  const dt=running?Math.min(.05,Math.max(0,delta)):0,s=this.options.getState(),a=this.action;
  this.robot.userData.rackPayload.visible=false;
  if(a?.phase==="align"){this.walk.update(dt);this.walk.draw(dt);}
  if(a||s.carriedItem||this.crouch||this.bend)this.posture(dt);
  if(this.arm.active)this.arm.apply();
  if(a&&dt){
   if(s.alarm.status==='active'&&!['drop','container','contain','device-off'].includes(a.selected.type)&&a.phase!=='recover'){this.options.message('泄漏报警，请先放下手持物并处置异常。');this.recover();}
   a.time+=dt;a.total+=dt;
   if(a.total>30&&a.phase!=="recover"){this.lastResult={type:"timeout",phase:a.phase,error:this.arm.graspPose().position.distanceTo(a.point)};this.options.message("动作受阻，请重新靠近");this.recover();}
   if(a.phase==="align"&&this.walk.ready){this.arm.capture();a.rest=[...this.arm.angles];this.desiredCrouch=a.point.y<.18?1:a.point.y<.6?.8:0;this.desiredBend=a.point.y<.9?1:.25;this.phase("prepare");}
   else if(a.phase==="prepare"&&Math.abs(this.crouch-this.desiredCrouch)<.01&&Math.abs(this.bend-this.desiredBend)<.01){this.target(a.point,true);this.phase("reach");}
   else if(a.phase==="reach"){
    if(a.time>.65&&this.arm.graspPose().position.distanceTo(a.point)<.025){
     if(["device-off","cabinet-power","case-seal","case-activate"].includes(a.selected.type))this.phase("operate");
     else{const next=this.commit();this.desiredCrouch=0;this.desiredBend=0;next.carriedItem?this.phase("lift"):this.recover();}
    }else if(a.time>2&&a.time-(a.lastPlan??0)>2){this.target(a.point,true);a.lastPlan=a.time;}
   }else if(a.phase==="operate"){
    const t=a.time,p=a.point.clone();
    if(a.selected.type==="mop")p.x+=Math.sin(t*4)*.16;
    if(["device-off","cabinet-power"].includes(a.selected.type))p.x+=Math.sin(t*5)*.025;
    this.target(p);
    if(t> (a.selected.type==="mop"?3:2)){this.commit();this.recover();}
   }else if(a.phase==="lift"){
    this.target(this.holdPoint(),a.time>2&&a.time-(a.lastLift??0)>2);
    if(a.time-(a.lastLift??0)>2)a.lastLift=a.time;
    if(a.time>1.4&&this.crouch<.01&&this.bend<.01&&this.arm.graspPose().position.distanceTo(this.holdPoint())<.07){this.action=null;}
   }else if(a.phase==="recover"){
    if(s.carriedItem)this.target(this.holdPoint(),a.time>2&&a.time-(a.lastRecover??0)>2);
    if(a.time-(a.lastRecover??0)>2)a.lastRecover=a.time;
    if(a.time>1.5&&this.crouch<.01&&this.bend<.01){if(a.complete&&!this.options.getState().failed)this.options.setState({...this.options.getState(),complete:true,settling:false});this.options.setState({...this.options.getState(),doorOpen:false});this.action=null;if(!this.options.getState().carriedItem)this.arm.active=false;}
   }
  }
  const now=this.options.getState(),held=now.carriedItem;
  if(held&&!this.action)this.target(this.holdPoint());
  if(this.arm.active){this.arm.update(dt);this.arm.apply();}
  this.heldRoot.visible=Boolean(held);
  for(const[k,m]of Object.entries(this.templates))m.visible=k===held;
  if(held==='transport-case'){
   const r=this.templates[held];const contents=r.getObjectByName('rf07-case-samples');if(contents)contents.visible=false;
   const closed=r.getObjectByName('rf07-case-lid-closed'),open=r.getObjectByName('rf07-case-lid-open');if(closed)closed.visible=true;if(open)open.visible=false;
  }
  if(held){
   const hand=this.arm.graspPose().position;this.heldRoot.position.copy(hand);this.heldRoot.quaternion.setFromAxisAngle(up,now.player.yaw+(held==='transport-case'?Math.PI:0));
   this.heldRoot.position.sub(new THREE.Vector3(0,gripHeight[held],held==='transport-case'?.27:0).applyQuaternion(this.heldRoot.quaternion));
   this.robot.userData.robotProfile.setGrip?.(this.robot.userData.officialModel,.55);
  }
 }
 snapshot(){return {fps:this.fps,phase:this.action?.phase??"idle",selected:this.action?.selected,stand:this.action?.stand,error:this.action?this.arm.graspPose().position.distanceTo(this.action.point):null,lastResult:this.lastResult,contacts:this.contacts,walk:this.walk.snapshot()};}
}
