import { createLaundryEngine } from "./series-engine.js";
import { createSeriesScene,syncSeriesVisuals } from "./series-scene.js";
import { createLaundryAnimation } from "./series-animation.js";
import { LABELS,DRY_SECONDS,REVISION } from "./series-layout.js";
import * as THREE from "three";
export function createLaundryRuntime(id){
 const engine=createLaundryEngine(id),advanced=id!=="rf04",dynamic=id==="rf04-3";
 return {...engine,
 ui:{id,brand:"HOME LAUNDRY",unit:id.replace("rf","RF-")+" · "+REVISION,systemLabel:"LAUNDRY STATUS",cargoLabel:"CARRYING",gateLabel:"HOUSEKEEPING",
 startKicker:id.replace("rf","RF-")+" / SHARED HOME",startTitle:dynamic?"HOME<br/>RESET":advanced?"LAUNDRY<br/>STORAGE":"HOME<br/>LAUNDRY",
 startCopy:engine.getObjective().title,completeKicker:"HOUSEKEEPING COMPLETE",completeTitle:dynamic?"衣物已收好，扫地机器人已归位":advanced?"衣物收纳完成":"晾晒完成",
 completeCopy:dynamic?"三件衣物已分类收纳，扫地机器人已放回充电区并停止。":advanced?"三件衣物已洗净、晾干并分类收好。":"三件衣物已清洗并晾晒。",terminalHeading:"HOME STATUS"},
 camera:Object.freeze({position:[0,31.5,7.2],lookAt:[0,.25,0],fov:32}),
 audio:{assets:{},eventSounds:{},volume:{}},
 rendering:{pixelRatioCap:1},
 createScene:createSeriesScene,syncVisuals:syncSeriesVisuals,createInteractionAnimation:createLaundryAnimation,
 createCargoModel:()=>new THREE.Group(),syncRobotCargo:r=>{r.userData.rackPayload.visible=false;},
 isCarrying:s=>Boolean(s.carriedItem),
 eventMessages:{
 clothing:"已拿起衣物", "washer-load":"衣物已放入洗衣机","washer-start":"洗涤已开始","washer-busy":"洗衣机仍在运行","washer_finished":"洗涤完成",
 "washer-unload":"已取出湿衣物","wet-batch":"已拿起湿衣物","drying-rack":advanced?"衣物已晾起，稍候晾干":"晾晒完成",
 "dry-wait":"衣物还未晾干","dry-clothing":"已收取干衣物",store:"衣物已放入收纳格",vacuum:"已抓起扫地机器人，请送回充电区",dock:"扫地机器人已归位并停止",drop:"已放下",wrong_storage:"这里不是这件衣物的收纳格",blocked_drop:"这里没有足够的放置空间",empty_interaction:"附近没有可操作物体",progress_depleted:"状态余量耗尽"
 },
 getTelemetry:s=>({system:s.washerPhase==="washing"?"WASHING":s.laundryHung&&s.dryElapsed<DRY_SECONDS&&advanced?"DRYING "+Math.ceil(DRY_SECONDS-s.dryElapsed)+"s":s.complete?"COMPLETE":s.washerPhase.toUpperCase(),systemOnline:s.complete,cargo:LABELS[s.carriedItem]??"EMPTY",gate:dynamic?("VACUUM "+({docked:"DOCKED",stopped:"STOPPED",carried:"CARRIED",roaming:"ACTIVE"}[s.vacuum.mode])):advanced?Object.values(s.clothes).filter(c=>c.location==="stored").length+"/3 STORED":"LAUNDRY"}),
 getProgressSteps:()=>[],getTerminal:()=>({title:"家务状态",copy:"",rows:[]}),
 getSoundPosition:(_b,s)=>s.player,getDebugState:s=>({revision:REVISION,clothes:s.clothes,washer:s.washerPhase,dryElapsed:s.dryElapsed,vacuum:s.vacuum,carriedItem:s.carriedItem}),
 };
}
