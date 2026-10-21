import * as THREE from "three";
import { BrowserArmScript } from "../rf15/browser-arm-script.js";
import { InteractionWalk, approachPath } from "../rf15/interaction-walk.js";
import { dist, clearCircle, REVISION } from "./series-layout.js";
const up=new THREE.Vector3(0,1,0), idle=()=>({move:0,strafe:0,turn:0,drain:false});
export function createLaundryAnimation(world,robot,options){return new LaundryAnimation(world,robot,options);}
export function findLaundryStand(runtime,s,p,selected){
  const candidates=[];
  for(const radius of(s.carriedItem?[.60,.68,.76]:(p.y<.16?[.48,.54]:[.48,.58,.68])))for(let i=0;i<24;i++){
   const yaw=i*Math.PI/12, offset=selected.type==="vacuum"||s.carriedItem==="vacuum"?0:.14;
   const stand={x:p.x-Math.sin(yaw)*radius+Math.cos(yaw)*offset,z:p.z-Math.cos(yaw)*radius-Math.sin(yaw)*offset,yaw};
   if((s.carriedItem&&!clearCircle(stand.x,stand.z,.57))||!runtime.isWalkable({...s,player:stand},stand.x,stand.z)||!runtime.getInteraction({...s,player:stand},selected))continue;
   // A washer pickup adds a front payload: reserve its full turning envelope
   // before crouching, rather than leaving the player inside collision after pickup.
   if(selected.type==="washer-unload"){
    const carrying={...s,player:stand,carriedItem:"wet-batch"};
    if(!clearCircle(stand.x,stand.z,.57)||!runtime.isWalkable(carrying,stand.x,stand.z))continue;
   }
   candidates.push({stand,score:dist(s.player,stand)+radius*3});
  }
  candidates.sort((a,b)=>a.score-b.score);
  for(const c of candidates)if(approachPath(s,c.stand,runtime))return c.stand;
  return null;
 }
class LaundryAnimation {
 constructor(world,robot,options){
  this.world=world;this.robot=robot;this.options=options;this.arms={};
  for(const side of ["left","right"])this.arms[side]=new BrowserArmScript(robot,side);
  this.walk=new InteractionWalk(this);this.heldRoot=new THREE.Group();world.scene.add(this.heldRoot);
  for(const [id,m]of Object.entries(world.carryTemplates)){const c=m.clone(true);c.name=id;c.visible=false;this.heldRoot.add(c);}
  this.reset();world.laundryController=this;
  // Explicit QA entry, absent in normal player URLs. Only robot placement; task actions remain real.
  if(new URLSearchParams(location.search).get("rf04qa")==="1"){
   window.__RF04_QA__={
    place:(p)=>{if(this.busy)throw Error("Cannot place during animation");const s=options.getState();if(!options.runtime.isWalkable(s,p.x,p.z))throw Error("Invalid QA station");options.stop();options.setState({...s,player:{...s.player,...p}});},
    snapshot:()=>this.snapshot(),state:()=>structuredClone(options.getState()),
    interact:()=>this.interact(),world:()=>world,robot:()=>robot,
   };
   import("./series-qa.js").then(m=>m.installLaundryQA(this));
  }
 }
 reset(){this.action=null;this.walk?.reset();this.crouch=0;this.bend=0;this.requestedCrouch=0;this.requestedBend=0;this.pendingCompletion=false;this.heldRoot.visible=false;for(const a of Object.values(this.arms))a.active=false;this.lastResult=null;}
 get busy(){return Boolean(this.action);}
 standFor(s,p,selected){return findLaundryStand(this.options.runtime,s,p,selected);}
 interact(){
  if(this.busy)return true;
  let s=this.options.getState();const selected=this.options.runtime.getInteraction(s);
  if(!selected)return false;
  if(["washer-busy","dry-wait"].includes(selected.type)||(selected.type==="store"&&selected.bay!==s.carriedItem)){
   const n=this.options.runtime.interact(s,selected);this.options.setState(n);this.options.message(this.options.runtime.eventMessages[n.lastEvent]);return true;
  }
  // F stops the nearby vacuum synchronously, before any alignment or crouching.
  s=this.options.runtime.beginInteraction(s,selected);this.options.setState(s);
  const point=new THREE.Vector3(selected.point.x,selected.point.y,selected.point.z);
  const stand=selected.type==="drop"?{...s.player}:this.standFor(s,point,selected);
  if(!stand){this.options.message("请从物体旁的空位靠近");return true;}
  this.options.stop();
  this.action={selected,point,stand,phase:"align",time:0,total:0,carried:s.carriedItem,rest:{},two:selected.type==="vacuum"||s.carriedItem==="vacuum"};
  if(!this.walk.begin(stand,stand.yaw)){this.action=null;return true;}
  this.options.setState({...s,actionTarget:selected.type==="vacuum"?"vacuum":selected.type});
  return true;
 }
 motionInput(s){
  if(this.action?.phase!=="align")return idle();
  const input=this.walk.input(s);
  if(s.carriedItem&&input.turn){
   const trial={...s,player:{...s.player,yaw:s.player.yaw+input.turn*.12}};
   if(!this.options.runtime.isWalkable(trial,trial.player.x,trial.player.z)){
    const p=this.walk.route?.[this.walk.index];if(p){
     const dx=p.x-s.player.x,dz=p.z-s.player.z,d=Math.hypot(dx,dz)||1,scale=Math.min(.24,d*2)/this.options.runtime.LEVEL.moveSpeed;
     this.walk.stage="walk";
     return {move:(dx*Math.sin(s.player.yaw)+dz*Math.cos(s.player.yaw))/d*scale,strafe:(dx*Math.cos(s.player.yaw)-dz*Math.sin(s.player.yaw))/d*scale,turn:0,drain:true};
    }
   }
  }
  return input;
 }
 phase(p){this.action.phase=p;this.action.time=0;}
 posture(dt){
  if(!this.action&&!this.options.getState().carriedItem)return;
  this.crouch+=THREE.MathUtils.clamp(this.requestedCrouch-this.crouch,-dt*.65,dt*.65);
  this.bend+=THREE.MathUtils.clamp(this.requestedBend-this.bend,-dt*.85,dt*.85);
  const model=this.robot.userData.officialModel,set=this.robot.userData.robotProfile.setJointAngle;
  const feet=["left","right"].map(s=>model.getObjectByName(s+"_ankle_roll_link"));
  const center=()=>feet.reduce((v,f)=>v.add(f.getWorldPosition(new THREE.Vector3())),new THREE.Vector3()).multiplyScalar(.5);
  this.robot.updateMatrixWorld(true);const before=center();
  if(this.crouch>.001){
   const knee=this.crouch*2.7,ankle=-this.crouch*.87;
   for(const side of ["left","right"]){set(model,side+"_hip_pitch_link",-knee-ankle);set(model,side+"_knee_link",knee);set(model,side+"_ankle_pitch_link",ankle);}
  }
  const ground=this.action?.point.y<.16;
  this.robot.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),this.bend*(ground?.5:.25)));
  set(model,"torso_link",.25+this.bend*(ground?.85:this.action?.point.y>1.1?.25:.55));
  this.robot.updateMatrixWorld(true);
  if(this.bend>.001||this.crouch>.001)this.robot.position.add(before.sub(center()));
  this.robot.updateMatrixWorld(true);
 }
 handTargets(point,two=false){
  const yaw=this.options.getState().player.yaw;
  return Object.fromEntries((two?["left","right"]:["right"]).map(side=>[side,point.clone().add(new THREE.Vector3(side==="left"?.155:-.155,0,0).applyAxisAngle(up,yaw).multiplyScalar(two?1:0))]));
 }
 holdPoint(two=false){return this.robot.localToWorld(new THREE.Vector3(two?0:-.15,.96,.32));}
 activeArms(){return this.action?.two||this.options.getState().carriedItem==="vacuum"?["left","right"]:["right"];}
 plan(point,two,full=false){for(const[side,target]of Object.entries(this.handTargets(point,two))){const arm=this.arms[side];if(!arm.active)arm.capture();if(full)arm.plan(target,null);else arm.solve(target,null,12);}}
 vacuumContactError(point){
  const hands=["left","right"].map(side=>this.arms[side].graspPose().position);
  if(hands[0].distanceTo(hands[1])<.20)return Infinity;
  return Math.max(...hands.map(p=>Math.hypot(Math.hypot(p.x-point.x,p.z-point.z)-.175,p.y-point.y)));
 }
 error(point,two){if(this.action?.selected.type==="vacuum")return this.vacuumContactError(point);return Math.max(...Object.entries(this.handTargets(point,two)).map(([side,target])=>this.arms[side].graspPose().position.distanceTo(target)));}
 recover(){this.requestedCrouch=0;this.requestedBend=0;this.phase("recover");if(!this.options.getState().carriedItem)for(const[side,arm]of Object.entries(this.arms))if(this.action.rest[side])arm.targetAngles=[...this.action.rest[side]];}
 cancel(){if(this.action){this.lastResult={type:"alignment-blocked",player:this.options.getState().player,stand:this.action.stand,phase:this.action.phase};this.options.stop();this.recover();}}
 commit(){
  const s=this.options.getState(),next=this.options.runtime.interact(s,this.action.selected);
  if(next.interactions===s.interactions){this.lastResult={type:"rejected",event:next.lastEvent};this.options.message("目标已离开抓取范围，请重新靠近");this.recover();return null;}
  if(next.complete){next.complete=false;next.settling=true;this.pendingCompletion=true;}
  this.options.setState(next);this.options.message(this.options.runtime.eventMessages[next.lastEvent]??"");
  this.lastResult={type:this.action.selected.type,contactError:this.error(this.action.point,this.action.two),revision:REVISION};
  return next;
 }
 frame(delta,running){
  const dt=running?Math.min(.05,Math.max(0,delta)):0,s=this.options.getState(),a=this.action;
  this.robot.userData.rackPayload.visible=false;
  if(a?.phase==="align"){this.walk.update(dt);this.walk.draw(dt);}
  this.posture(dt);for(const arm of Object.values(this.arms))if(arm.active)arm.apply();
  if(a&&dt>0){
   a.time+=dt;a.total+=dt;
   if(a.total>35&&a.phase!=="recover"){this.lastResult={type:"timeout",phase:a.phase,player:s.player,stand:a.stand,target:a.point.toArray(),error:this.error(a.point,a.two)};this.options.message("动作未完成，请重新靠近");this.recover();}
   if(a.phase==="align"&&this.walk.ready){
    for(const[side,arm]of Object.entries(this.arms)){arm.capture();a.rest[side]=[...arm.angles];}
    this.requestedCrouch=a.point.y<.55?1:a.point.y<.9?.12:0;
    this.requestedBend=1;this.phase("prepare");
   }else if(a.phase==="prepare"&&Math.abs(this.crouch-this.requestedCrouch)<.01&&this.bend>.99){
    this.plan(a.point,a.two,true);this.phase("reach");
   }else if(a.phase==="reach"){
    if(a.time>1.2&&this.error(a.point,a.two)<.055){
     const next=this.commit();
     if(next){this.requestedCrouch=0;this.requestedBend=0;if(next.carriedItem)this.phase("lift");else this.recover();}
    }else if(a.time>2.5&&a.time-(a.lastPlan??0)>2){this.plan(a.point,a.two,true);a.lastPlan=a.time;}
   }else if(a.phase==="lift"){
    this.plan(this.holdPoint(a.two),a.two);
    if(this.crouch<.01&&this.bend<.01&&a.time>1.4&&this.error(this.holdPoint(a.two),a.two)<.06){
     this.action=null;this.options.setState({...this.options.getState(),actionTarget:null});
    }
   }else if(a.phase==="recover"&&this.crouch<.01&&this.bend<.01&&a.time>1.4){
    const n={...this.options.getState(),actionTarget:null};
    if(this.pendingCompletion){n.complete=true;n.settling=false;this.pendingCompletion=false;}
    this.options.setState(n);this.action=null;
    if(!n.carriedItem)for(const arm of Object.values(this.arms))arm.active=false;
   }
  }
  const now=this.options.getState(),held=now.carriedItem;
  if(held&&!this.action)this.plan(this.holdPoint(held==="vacuum"),held==="vacuum");
  for(const arm of Object.values(this.arms))if(arm.active)arm.update(dt);
  this.heldRoot.visible=Boolean(held);
  if(held){
   for(const c of this.heldRoot.children)c.visible=c.name===held;
   const pos=held==="vacuum"?this.arms.right.graspPose().position.clone().add(this.arms.left.graspPose().position).multiplyScalar(.5):this.arms.right.graspPose().position;
   this.heldRoot.position.copy(pos).add(new THREE.Vector3(0,held==="vacuum"?-.055:-.035,0));
   this.heldRoot.rotation.set(0,now.player.yaw,0);
   this.robot.userData.robotProfile.setGrip?.(this.robot.userData.officialModel,.55);
  }
 }
 snapshot(){return {revision:REVISION,phase:this.action?.phase??(this.options.getState().carriedItem?"holding":"idle"),selected:this.action?.selected,point:this.action?.point.toArray(),crouch:this.crouch,bend:this.bend,held:this.options.getState().carriedItem,lastResult:this.lastResult,hands:Object.fromEntries(Object.entries(this.arms).map(([s,a])=>[s,a.graspPose().position.toArray()])),walk:this.walk.snapshot()};}
}
