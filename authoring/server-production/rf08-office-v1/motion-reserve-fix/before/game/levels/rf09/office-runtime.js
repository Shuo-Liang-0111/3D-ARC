import * as THREE from "three";
import {createOfficeEngine} from "./office-engine.js";
import {createOfficeSeriesScene,syncOfficeSeries,prepareOfficeView} from "./office-scene.js";
import {createOfficeAnimation} from "./office-animation.js";
import {LABELS,OBJECTIVES,TYPES,REVISION} from "./office-layout.js";
export function createOfficeRuntime(id){
 const e=createOfficeEngine(id),label=LABELS[id],title={rf09:"办公室整理","rf09-2":"会前布置","rf09-3":"动态办公服务"}[id];
 const messages={pickup:"已拿起物品",return:"已归还正确位置",seat:"已摆放至席位",drop:"已放下，可重新拿取",grip:"已扶住椅背，使用移动键推行，按 F 松手",release:"已松开会议椅","paper-load":"纸张已放入，请按打印机按钮",printer:"正在打印，请等待出纸",deliver:"服务物资已交付",wrong_target:"该物品不属于这个位置",request_pending:"资料回收请求尚未发布",seat_occupied:"这个席位已有同类物品",printer_needs_paper:"打印机缺纸，请先补充 A4 纸",printing_wait:"打印尚未完成，请等待出纸",not_ready:"请完成四席资料、饮水与两张椅子归位",no_target:"靠近物品或设备再按 F"};
 return {...e,ui:{id,levelLabel:label,brand:title,unit:label+" · OFFICE SERVICES",systemLabel:"OFFICE",cargoLabel:"物品",gateLabel:"任务进度",startKicker:label+" / OFFICE SERVICES",startTitle:title,startCopy:OBJECTIVES[id],completeKicker:"TASK COMPLETE",completeTitle:"任务完成",completeCopy:OBJECTIVES[id],terminalHeading:"办公室服务"},
 camera:{position:[0,28,8.5],lookAt:[0,.4,-.4],fov:34},audio:{assets:{},eventSounds:{},volume:{}},eventMessages:messages,
 createScene:createOfficeSeriesScene,syncVisuals:(world,s)=>{
 syncOfficeSeries(world,s);
 if(!world.taskStatus){const host=document.querySelector("#objective-title")?.parentElement;if(host){world.taskStatus=document.createElement("p");world.taskStatus.style.cssText="font-size:13px;line-height:1.7;white-space:pre-line;color:#d4ddcc;margin:12px 0 0";world.taskStatus.id="office-task-status";host.append(world.taskStatus);}}
 if(world.taskStatus){const q=e.readiness(s),line=id==="rf09"?Object.entries(s.returned).map(([k,v])=>(v?"✓ ":"○ ")+TYPES[k].name).join("  "):id==="rf09-2"?"席位 "+s.seats.map(x=>(x.doc&&x.water?"✓":"○")+x.id).join("  ")+"\n两张会议椅 "+(q.chairs?"已归位":"待归位"):s.requests.filter(r=>r.status!=="pending").map(r=>(r.status==="done"?"✓ ":"○ ")+({print:"加印资料并送到会议桌",water:"补充饮水 "+(r.count??0)+" / 2",collect:"回收会议资料"}[r.id])).join("\n");const a=e.getInteraction(s),text=line+(a?"\nF · "+a.label:"");if(world.taskStatus.textContent!==text)world.taskStatus.textContent=text;}
 },prepareView:prepareOfficeView,createInteractionAnimation:createOfficeAnimation,
 createCargoModel:()=>new THREE.Group(),syncRobotCargo:r=>{r.userData.rackPayload.visible=false;},isCarrying:s=>Boolean(s.carriedItem),getProgressSteps:()=>[],
 getTelemetry:s=>{const q=e.readiness(s);return {system:s.complete?"COMPLETE":s.printer.phase==="printing"?"PRINTING":"READY",systemOnline:true,cargo:s.carriedItem?TYPES[s.items[s.carriedItem].type].name:s.attachment?"推椅":"EMPTY",gate:id==="rf09"?q.returned+"/3 归位":id==="rf09-2"?q.seats+"/4 席位":q.requests+"/3 请求"};},
 getTerminal:()=>({title,copy:OBJECTIVES[id],rows:[]}),getSoundPosition:(_s,n)=>n.player,
 getDebugState:s=>({revision:REVISION,carriedItem:s.carriedItem,attachment:s.attachment,printer:s.printer,requests:s.requests,returned:s.returned,seats:s.seats,chairs:s.chairs,settling:s.settling}),
 };
}
