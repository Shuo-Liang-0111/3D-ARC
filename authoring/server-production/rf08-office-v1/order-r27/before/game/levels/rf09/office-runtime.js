import * as THREE from "three";
import {createOfficeEngine} from "./office-engine.js";
import {createOfficeClock} from "./office-clock.js";
import {createOfficeSeriesScene,syncOfficeSeries,prepareOfficeView} from "./office-scene.js";
import {createOfficeAnimation} from "./office-animation.js";
import {LABELS,OBJECTIVES,TYPES,REVISION} from "./office-layout.js";
export function createOfficeRuntime(id){
 const e=createOfficeEngine(id),clock=createOfficeClock(e),label=LABELS[id],title={rf09:"会议准备","rf09-2":"通道整理","rf09-3":"会务来电"}[id];
 const messages={progress_depleted:"状态余量耗尽，请重新开始",pickup:"已拿起物品",seat:"已摆好物品",drop:"已放下，可重新拿取",grip:"已扶住椅背，使用移动键推到会议桌前，按 F 松手",release:"已松开椅子",chair_parked:"椅子已归位，会议室通道已畅通",chair_not_parked:"先将挡路椅子推到会议桌前",seat_occupied:"这里已有同类物品",path_blocked:"这里无法放下物品",no_target:"靠近文件、水、椅子或来电电话后按 F",phone_ringing:"电话响了！请在 30 秒内到电话旁按 F 接听",phone_answered:"电话已接听，请继续布置",phone_timeout:"30 秒内未接听电话，任务失败",setup_complete:"会议准备完成"};
 const factory=(world,robot,options)=>{
  const controller=createOfficeAnimation(world,robot,options);
  // Continue the deadline even if the rendering loop is throttled in a background tab.
  const timer=setInterval(()=>{const s=options.getState();if((s.phone.status==="pending"||s.phone.status==="ringing")&&!s.complete&&!s.failed)options.setState(clock.updateEnvironment(s));},100);
  window.addEventListener("pagehide",()=>clearInterval(timer),{once:true});return controller;
 };
 return {...e,...clock,ui:{id,levelLabel:label,brand:title,unit:label+" · OFFICE SERVICES",systemLabel:"OFFICE",cargoLabel:"物品",gateLabel:"布置",startKicker:label+" / OFFICE SERVICES",startTitle:title,startCopy:OBJECTIVES[id],completeKicker:"TASK COMPLETE",completeTitle:"会议准备完成",completeCopy:OBJECTIVES[id],terminalHeading:"办公室服务"},
 camera:{position:[0,28,8.5],lookAt:[0,.4,-.4],fov:34},audio:{assets:{},eventSounds:{},volume:{}},eventMessages:messages,
 createScene:createOfficeSeriesScene,syncVisuals:(world,s)=>{
  syncOfficeSeries(world,s);
 },prepareView:prepareOfficeView,createInteractionAnimation:factory,
 createCargoModel:()=>new THREE.Group(),syncRobotCargo:r=>{r.userData.rackPayload.visible=false;},isCarrying:s=>Boolean(s.carriedItem),getProgressSteps:()=>[],
 getTelemetry:s=>{const q=e.readiness(s);return {system:s.failed?"FAILED":s.complete?"COMPLETE":s.phone.status==="ringing"?"CALL · "+Math.ceil(s.phone.remaining)+"s":"READY",systemOnline:!s.failed,cargo:s.carriedItem?TYPES[s.items[s.carriedItem].type].name:s.attachment?"推椅":"EMPTY",gate:Number(q.documents)+Number(q.water)+"/2 物品"};},
 getFailureMessage:s=>s.failureReason==="phone_timeout"?"未在响铃后的 30 秒内接听电话，任务失败。按 R 重新开始。":"状态余量耗尽，办公室任务终止。按 R 重新开始。",
 getTerminal:()=>({title,copy:OBJECTIVES[id],rows:[]}),getSoundPosition:(_s,n)=>n.player,
 getDebugState:s=>({revision:REVISION,carriedItem:s.carriedItem,attachment:s.attachment,phone:s.phone,seats:s.seats,chairs:s.chairs,settling:s.settling}),
 };
}
