import * as THREE from "three";
import { createCourtEngine } from "./series-engine.js";
import { createSeriesScene,syncSeriesVisuals } from "./series-scene.js";
import { createCourtAnimation } from "./series-animation.js";
import { TYPES,REVISION } from "./series-layout.js";
export function createSeriesRuntime(id){
 const engine=createCourtEngine(id),suffix=id==="rf14"?"":id.slice(4),label="RF-12"+suffix,rain=engine.rainEnabled;
 let clockAt=null;
 return {...engine,
 ui:{id,levelLabel:label,brand:rain?"网球场 · 雨中分类":engine.sorting?"网球场 · 分类归筐":"网球场 · 捡球归筐",unit:label+" · COURT 01",systemLabel:rain?"天气":"球场",cargoLabel:"携带",gateLabel:"归筐",
 startKicker:label+" / TENNIS COURT",startTitle:rain?"雨中收球<br>棚下避雨":engine.sorting?"训练用球<br>分类归筐":"训练结束<br>捡球归筐",startCopy:engine.getObjective(engine.createInitialState()).title,
 completeKicker:"COURT READY",completeTitle:"球场整理完成",completeCopy:rain?"两类网球已正确归筐，雨天任务完成。":engine.sorting?"黄色标准球与橙色训练球各4颗，已分别归筐。":"8颗网球已全部归筐。",terminalHeading:label+" / 收集记录"},
 camera:Object.freeze({position:[0,18.5,16],lookAt:[0,.6,0],fov:43}),
 audio:{assets:{},eventSounds:{},volume:{}},
 createInitialState(options){clockAt=null;return engine.createInitialState(options);},
 resetWeatherClock(){clockAt=null;},
 updateEnvironment(s,delta){const now=performance.now(),dt=clockAt===null?delta:Math.max(0,(now-clockAt)/1000);clockAt=now;return engine.updateEnvironment(s,dt);},
 createScene:createSeriesScene,syncVisuals:syncSeriesVisuals,createInteractionAnimation:createCourtAnimation,
 createCargoModel:()=>new THREE.Group(),syncRobotCargo:r=>{if(r.userData.rackPayload)r.userData.rackPayload.visible=false;},
 isCarrying:s=>Boolean(s.carriedItem),
 eventMessages:{ball_picked:"已捡起网球",ball_sorted:"网球已归入对应分筐",wrong_bin:"放错筐了 · 空手靠近此筐按 F 可取回纠正",ball_dropped:"已放下网球",court_complete:"全部网球已归筐",drop_blocked:"这里不能安全放球",rain_started:"开始下雨 · 请前往东侧雨棚",rain_stopped:"雨停了",rain_failed:"本场累计淋雨超过30秒",progress_depleted:"任务余量耗尽"},
 getTelemetry:s=>({system:s.complete?"完成":rain?(s.weather.raining?(s.weather.sheltered?"棚下避雨":"淋雨 "+s.weather.exposure.toFixed(1)+"s"):"晴朗"):"收集",systemOnline:s.complete,cargo:s.carriedItem?TYPES[s.items[s.carriedItem].type].name:"空手",gate:s.delivered.length+"/8"}),
 getProgressSteps:()=>[],getTerminal:s=>({title:"收集记录",copy:"",rows:[["正确归筐",s.delivered.length+"/8"]]}),
 getFailureMessage:s=>s.failureReason==="rain_exposure"?"本场雨累计淋雨超过30秒。进入东侧雨棚可暂停累计，下一场雨重新计时。按 R 重新开始。":"任务余量耗尽，请重新开始。",
 getSoundPosition:(_b,s)=>s.player,getDebugState:s=>({revision:REVISION,items:s.items,weather:s.weather,carriedItem:s.carriedItem,delivered:s.delivered})
 };
}
