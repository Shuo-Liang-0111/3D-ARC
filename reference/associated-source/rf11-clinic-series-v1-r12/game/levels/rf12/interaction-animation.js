import * as THREE from "three";
import { BrowserArmScript } from "../rf15/browser-arm-script.js";
import { InteractionWalk, approachPath } from "../rf15/interaction-walk.js";
import { KITCHEN, GRIPS, REVISION, itemPose, gripPoint, dropPoint } from "./interaction-layout.js";
const up=new THREE.Vector3(0,1,0),vec=p=>new THREE.Vector3(p.x,p.y,p.z);
const idle=()=>({move:0,strafe:0,turn:0,drain:false});
const pickupTypes={"pickup":"oil","pickup-pan":"pan","pickup-kettle":"kettle","pickup-extinguisher":"extinguisher","cloth":"cloth"};
const placeTypes={"place":["oil","prep"],"place-pan":["pan","burner"],"place-kettle":["kettle","burner"],"cloth-safe":["cloth","sink"]};
export function describeAction(s,a,runtime){
 const result={...a};
 if(pickupTypes[a.type]){result.item=pickupTypes[a.type];result.kind="pickup";result.pose=itemPose(s,result.item);result.point=gripPoint(result.pose,result.item);}
 else if(placeTypes[a.type]){const [item,target]=placeTypes[a.type];result.item=item;result.kind="place";result.pose=KITCHEN[target];result.point=gripPoint(result.pose,item);}
 else if(a.type==="fill-kettle"){result.item="kettle";result.kind="fill";result.pose=KITCHEN.fill;result.point=gripPoint(result.pose,"kettle");}
 else if(a.type==="drop"){result.item=s.carriedItem;result.kind="place";result.pose=dropPoint(s,runtime.isWalkable);result.releasePoint=result.pose;result.point=gripPoint(result.pose,result.item);}
 else if(a.type==="window"){result.kind="window";result.point={...KITCHEN.window};}
 else if(a.type==="extinguish"){result.kind="spray";result.item="extinguisher";result.point={x:KITCHEN.burner.x-.18,y:.98,z:-2.12};}
 else {result.kind="switch";result.point=KITCHEN[({gasKnob:"knob","burner-on":"knob","burner-off":"knob",gasValve:"valve",checklist:"terminal"})[a.type]??a.type]??KITCHEN.terminal;}
 return result;
}
export function createKitchenInteractionAnimation(world,robot,options){return new KitchenAnimation(world,robot,options);}
export class KitchenAnimation {
 constructor(world,robot,options){
  this.world=world;this.robot=robot;this.options=options;
  this.arm=new BrowserArmScript(robot,"right");this.left=new BrowserArmScript(robot,"left");this.walk=new InteractionWalk(this);
  this.nozzle=new THREE.Mesh(new THREE.CylinderGeometry(.012,.025,.13,16),new THREE.MeshStandardMaterial({color:0x222625,roughness:.48}));
  this.nozzle.visible=false;world.scene.add(this.nozzle);
  this.hose=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshStandardMaterial({color:0x282929,roughness:.72}));this.hose.visible=false;world.scene.add(this.hose);
  world.controller=this;this.reset();
  if(new URLSearchParams(location.search).get("rf10qa")==="1")import("./interaction-qa.js").then(m=>m.installKitchenQA(this));
 }
 get busy(){return !!this.action;}
 reset(){this.qaPaused=false;this.qaStopAt=null;this.action=null;this.arm.active=this.left.active=false;this.walk.reset();this.crouch=this.bend=this.desiredCrouch=this.desiredBend=0;this.mounts={};this.contacts=[];this.lastResult=null;this.world.sprayAmount=this.world.fireSuppression=0;this.world.fillAmount=0;this.world.filling=false;this.world.windowSlide=0;}
 motionInput(s){if(this.qaPaused)return idle();return this.action?.phase==="align"?this.walk.input(s):this.action?idle():null;}
 standFor(s,a){
  if(a.kind==="window"){
   const stand={x:3.66,z:.09,yaw:Math.PI/2};
   if(approachPath(s,stand,this.options.runtime))return stand;
  }
  if(a.kind==="spray"){
   const stand={x:KITCHEN.burner.x,z:-1.70,yaw:Math.PI};
   if(approachPath(s,stand,this.options.runtime))return stand;
  }
  const p=a.point,candidates=[];
  for(const radius of (p.y<.65?[.36,.42,.5,.56]:[.38,.44,.5,.58,.64]))for(let i=0;i<48;i++){
   const yaw=i*Math.PI/24,stand={x:p.x-Math.sin(yaw)*radius+Math.cos(yaw)*.12,z:p.z-Math.cos(yaw)*radius-Math.sin(yaw)*.12,yaw};
   if([[0,0],[.04,0],[-.04,0],[0,.04],[0,-.04]].every(([x,z])=>this.options.runtime.isWalkable(s,stand.x+x,stand.z+z)))candidates.push({stand,score:Math.hypot(s.player.x-stand.x,s.player.z-stand.z)*.2+radius*3});
  }
  candidates.sort((a,b)=>a.score-b.score);
  return candidates.find(c=>approachPath(s,c.stand,this.options.runtime))?.stand;
 }
 interact(){
  if(this.action)return true;
  const s=this.options.getState(),choice=this.options.runtime.getInteraction(s);
  if(!choice){this.options.message("请靠近要操作的物品");return true;}
  const a=describeAction(s,choice,this.options.runtime),stand=this.standFor(s,a);
  if(!stand){this.options.message("操作点被遮挡，请从台面正面靠近");return true;}
  this.options.stop();this.lastResult=null;this.action={selected:a,point:vec(a.point),stand,phase:"align",time:0,total:0,committed:false,original:s.carriedItem};
  if(!this.walk.begin(stand,stand.yaw))this.action=null;
  return true;
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
  if(this.bend>.001||this.crouch>.001)this.robot.position.add(before.sub(center()));
  this.robot.updateMatrixWorld(true);
 }
 holdPoint(){const item=this.options.getState().carriedItem;return this.robot.localToWorld(new THREE.Vector3(item==="extinguisher"?-.30:-.24,item==="kettle"?.86:.78,item==="kettle"?.12:.30));}
 orientation(a){
  if(a?.selected.kind==="place"&&a.selected.item==="pan"&&this.mounts[a.selected.item]){
   return new THREE.Quaternion().setFromAxisAngle(up,a.selected.pose.yaw??0).multiply(this.mounts[a.selected.item].clone().invert());
  }
  return null;
 }
 target(p,plan=false,orientation=null){if(!this.arm.active)this.arm.capture();plan?this.arm.plan(p,orientation):this.arm.solve(p,orientation,5);}
 recover(){
  this.desiredCrouch=this.desiredBend=0;this.world.sprayAmount=0;this.world.filling=false;
  this.robot.userData.robotProfile.setGrip?.(this.robot.userData.officialModel,0);
  this.phase("recover");
  if(!this.options.getState().carriedItem&&this.action.rest)this.arm.targetAngles=[...this.action.rest];
  if(this.action.leftRest)this.left.targetAngles=[...this.action.leftRest];
 }
 cancel(){if(this.action)this.recover();}
 commit(){
  const a=this.action,s=this.options.getState(),next=this.options.runtime.interact(s,a.selected);
  if(next.interactions===s.interactions){this.lastResult={type:"cancelled",reason:"state-changed"};this.recover();return false;}
  if(a.selected.kind==="pickup"){
   const root=this.world.props[a.selected.item],hand=this.arm.graspPose();
   this.mounts[a.selected.item]=hand.rotation.clone().invert().multiply(root.quaternion);
  }
  a.committed=true;
  const result={type:a.reportType??a.selected.type,event:next.lastEvent,error:this.arm.graspPose().position.distanceTo(a.point),revision:REVISION};
  this.contacts.push(result);this.lastResult=result;
  if(next.complete){next.complete=false;next.settling=true;a.complete=true;}
  this.options.setState(next);this.options.message(this.options.runtime.eventMessages[next.lastEvent]??"");
  return true;
 }
 frame(delta,running){
  if(!running)this.options.runtime.resetBoilingClock?.();
  if(this.qaStopAt&&this.action?.phase===this.qaStopAt)this.qaPaused=true;
  const dt=running&&!this.qaPaused?Math.min(.05,Math.max(0,delta)):0,s=this.options.getState(),a=this.action;
  if(s.failed&&a){this.action=null;this.left.active=false;this.world.sprayAmount=this.world.fireSuppression=0;return;}
  if(this.robot.userData.rackPayload)this.robot.userData.rackPayload.visible=false;
  if(a?.phase==="align"){this.walk.update(dt);this.walk.draw(dt);}
  if(a||s.carriedItem||this.crouch||this.bend)this.posture(dt);
  if(this.arm.active)this.arm.apply();if(this.left.active)this.left.apply();
  if(a&&dt){
   a.time+=dt;a.total+=dt;
   if(a.total>45&&!["recover"].includes(a.phase)){this.lastResult={type:"timeout",phase:a.phase,error:this.arm.graspPose().position.distanceTo(a.point)};this.options.message("无法接触操作点，请重新靠近");this.recover();}
   if(a.phase==="align"&&this.walk.ready){
    this.arm.capture();a.rest=[...this.arm.angles];this.left.capture();a.leftRest=[...this.left.angles];
    this.desiredCrouch=a.point.y<.18?1:a.point.y<.65?.60:0;this.desiredBend=a.point.y<.85?.75:a.selected.item==="oil"?.32:a.selected.item==="cloth"?.55:a.selected.item==="kettle"?(a.selected.kind==="fill"?.32:.55):.18;this.phase("prepare");
   }else if(a.phase==="prepare"&&Math.abs(this.crouch-this.desiredCrouch)<.01&&Math.abs(this.bend-this.desiredBend)<.01){
    if(a.selected.kind==="spray"){this.target(this.holdPoint(),true);this.left.plan(a.point);this.phase("spray-ready");}
    else if(a.selected.item==="kettle"&&s.carriedItem==="kettle"&&a.selected.pose.y>.65){
     a.transit=this.holdPoint();a.transit.y=Math.max(a.point.y+.04,1.16);this.target(a.transit,true);this.phase("kettle-raise");
    }else {this.target(a.point,true,this.orientation(a));this.phase("reach");}
   }else if(a.phase==="kettle-raise"){
    if(a.time>.4&&this.arm.graspPose().position.distanceTo(a.transit)<.035){this.target(a.point,true);this.phase("reach");}
    else if(a.time>2&&a.time-(a.lastRaise??0)>2){this.target(a.transit,true);a.lastRaise=a.time;}
   }else if(a.phase==="reach"){
    if(a.time>.4&&this.arm.graspPose().position.distanceTo(a.point)<.025){
     if(a.selected.kind==="window"){a.windowTravel=0;this.phase("window-slide");}
     else if(a.selected.kind==="switch")this.phase("operate");
     else if(a.selected.kind==="fill"){this.world.fillAmount=0;this.world.filling=true;this.phase("fill");}
     else {if(this.commit()){
      if(a.selected.item==="kettle"&&this.options.getState().carriedItem){a.transit=this.holdPoint();a.transit.y=a.point.y+.03;this.target(a.transit,true);this.phase("kettle-retreat");}
      else{this.desiredCrouch=this.desiredBend=0;this.options.getState().carriedItem?this.phase("lift"):this.recover();}
     }}
    }else if(a.time>2&&a.time-(a.lastPlan??0)>2){this.target(a.point,true,this.orientation(a));a.lastPlan=a.time;}
   }else if(a.phase==="window-slide"){
    const travel=Math.min(.56,a.windowTravel+dt*.18);
    const point=vec(KITCHEN.window);point.z-=travel;
    this.target(point);
    this.robot.userData.robotProfile.setGrip?.(this.robot.userData.officialModel,.45);
    if(this.arm.graspPose().position.distanceTo(point)<.028){
     a.windowTravel=travel;this.world.windowSlide=travel;
     if(travel>=.56){a.point.copy(point);if(this.commit())this.recover();}
    }
   }else if(a.phase==="fill"){
    this.world.fillAmount=Math.min(1,a.time/3.5);
    if(a.time>=3.5){this.world.filling=false;if(this.commit()){a.transit=this.holdPoint();a.transit.y=a.point.y+.03;this.target(a.transit,true);this.phase("kettle-retreat");}}
   }else if(a.phase==="kettle-retreat"){
    if(a.time>.5&&this.arm.graspPose().position.distanceTo(a.transit)<.035){this.desiredCrouch=this.desiredBend=0;this.phase("lift");}
    else if(a.time>2&&a.time-(a.lastRetreat??0)>2){this.target(a.transit,true);a.lastRetreat=a.time;}
   }else if(a.phase==="operate"){
    // Turn/press at contact; clock starts or stops only at this event.
    if(a.time>.32){this.commit();this.recover();}
   }else if(a.phase==="spray-ready"){
    if(this.left.graspPose().position.distanceTo(a.point)<.035&&a.time>.5)this.phase("spray");
    else if(a.time>2&&a.time-(a.lastLeftPlan??0)>2){this.left.plan(a.point);a.lastLeftPlan=a.time;}
   }else if(a.phase==="spray"){
    this.world.sprayAmount=1;this.world.fireSuppression=THREE.MathUtils.clamp(a.time/3.2,0,.96);
    if(a.time>3.2){
     a.selected.holdAfter=true;
     if(!this.commit())return;
     a.reportType="extinguish";
     a.selected={...a.selected,type:"drop",kind:"place"};
     this.world.fireSuppression=0;
     this.world.sprayAmount=0;const p=dropPoint(this.options.getState(),this.options.runtime.isWalkable);
     a.selected.releasePoint=p;a.selected.pose=p;a.selected.kind="place";a.point.copy(vec(gripPoint(p,"extinguisher")));
     this.desiredCrouch=this.desiredBend=0;
     const stand=this.standFor(this.options.getState(),{point:a.point});
     if(!stand){this.options.message("请移到空地放下灭火器");this.recover();}
     else{a.stand=stand;this.phase("align");this.walk.begin(stand,stand.yaw);}
    }
   }else if(a.phase==="lift"){
    this.target(this.holdPoint(),a.time>2&&a.time-(a.lastLift??0)>2);
    if(a.time-(a.lastLift??0)>2)a.lastLift=a.time;
    if(a.time>1.1&&this.crouch<.01&&this.bend<.01&&this.arm.graspPose().position.distanceTo(this.holdPoint())<.055)this.action=null;
   }else if(a.phase==="recover"){
    if(s.carriedItem)this.target(this.holdPoint(),a.time>2&&a.time-(a.lastRecover??0)>2);
    if(a.time-(a.lastRecover??0)>2)a.lastRecover=a.time;
    if(a.time>1.5&&this.crouch<.01&&this.bend<.01){
     if(a.complete)this.options.setState({...this.options.getState(),complete:true,settling:false});
     this.action=null;this.world.fireSuppression=0;this.left.active=false;if(!this.options.getState().carriedItem)this.arm.active=false;
    }
   }
  }
  const current=this.options.getState(),held=current.carriedItem;
  if(held&&!this.action)this.target(this.holdPoint());
  if(this.arm.active){this.arm.update(dt);this.arm.apply();}
  if(this.left.active){this.left.update(dt);this.left.apply();}
  if(held){
   const root=this.world.props[held],pose=this.arm.graspPose();
   if(!this.mounts[held])this.mounts[held]=pose.rotation.clone().invert().multiply(root.quaternion);
   root.visible=true;
   if(held==="kettle"){
    // The kettle hangs upright from its overhead handle; the grip may pivot in the palm.
    const yaw=this.action?.selected.pose?.yaw??current.player.yaw+Math.PI;
    root.quaternion.slerp(new THREE.Quaternion().setFromAxisAngle(up,yaw),Math.min(1,dt*10));
   }else root.quaternion.copy(pose.rotation).multiply(this.mounts[held]);
   root.position.copy(pose.position).sub(new THREE.Vector3(...GRIPS[held]).applyQuaternion(root.quaternion));
   this.robot.userData.robotProfile.setGrip?.(this.robot.userData.officialModel,.5);
  }
  const spraying=["spray-ready","spray"].includes(this.action?.phase);
  this.nozzle.visible=this.hose.visible=spraying;
  if(spraying){
   const hand=this.left.graspPose().position,target=vec(KITCHEN.burner),direction=target.sub(hand).normalize();
   this.nozzle.position.copy(hand);this.nozzle.quaternion.setFromUnitVectors(up,direction);
   this.world.sprayOrigin.copy(hand).addScaledVector(direction,.075);
   const start=this.world.props.extinguisher.localToWorld(new THREE.Vector3(.06,.41,0));
   const mid=start.clone().lerp(hand,.5);mid.y-=.14;
   const curve=new THREE.CatmullRomCurve3([start,mid,hand]);
   this.hose.geometry.dispose();this.hose.geometry=new THREE.TubeGeometry(curve,16,.009,6,false);
  }
  this.world.scene.userData.interactionRevision=REVISION;
 }
 snapshot(){
  const s=this.options.getState(),item=s.carriedItem,root=this.world.props[item];
  const contact=root?root.localToWorld(new THREE.Vector3(...GRIPS[item])):null;
  return {revision:REVISION,phase:this.action?.phase??"idle",selected:this.action?.selected,stand:this.action?.stand,point:this.action?.point.toArray(),error:this.action?this.arm.graspPose().position.distanceTo(this.action.point):null,gripError:contact?contact.distanceTo(this.arm.graspPose().position):null,lastResult:this.lastResult,contacts:this.contacts,walk:this.walk.snapshot()};
 }
}
