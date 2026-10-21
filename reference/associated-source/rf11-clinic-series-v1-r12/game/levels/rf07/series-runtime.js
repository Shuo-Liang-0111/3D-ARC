import * as THREE from 'three';
import {createSeriesEngine,OBJECTIVES,REVISION} from './series-engine.js';
import {createSeriesScene,syncSeriesVisuals,prepareSeriesView} from './series-scene.js';
import {createSeriesAnimation} from './series-animation.js';
export function createSeriesRuntime(id){
 const e=createSeriesEngine(id);
 return {...e,ui:{id,brand:'LABORATORY OPERATIONS',unit:id.toUpperCase()+' · BIO LAB',systemLabel:'SYSTEM',cargoLabel:'CARGO',gateLabel:'CABINETS',startKicker:id.toUpperCase(),startTitle:({'rf07':'COLD-CHAIN<br>TRANSFER','rf07-2':'COLD STORAGE<br>INSPECTION','rf07-3':'LEAK<br>RESPONSE'})[id],startCopy:OBJECTIVES[id],completeKicker:'TASK COMPLETE',completeTitle:'任务完成',completeCopy:OBJECTIVES[id],terminalHeading:'实验室'},
 camera:{position:[0,28,6],lookAt:[0,.25,-.3],fov:33},rendering:{pixelRatioCap:1},audio:{assets:{},eventSounds:{},volume:{}},
 eventMessages:{'device-off':'故障设备已断电，泄漏已停止。','contain':'容器已放稳，泄漏已收容。','container':'已拿起泄漏容器。','drop':'已原地放下，可稍后取回。','cabinet-power':'冷藏柜电源状态已切换。','alarm_priority':'请先处置泄漏报警。','blocked_drop':'放置位置被遮挡，请移到空地。','order_required':'请先按任务板顺序装入三个样本。','wrong_cabinet':'请送入 02 号冷藏柜。'},
 createScene:createSeriesScene,syncVisuals:syncSeriesVisuals,prepareView:prepareSeriesView,createInteractionAnimation:createSeriesAnimation,
 createCargoModel:()=>new THREE.Group(),syncRobotCargo:r=>{r.userData.rackPayload.visible=false;},isCarrying:s=>Boolean(s.carriedItem),getProgressSteps:()=>[],
 updateEnvironment(s,dt){const now=performance.now(),elapsed=s.clockStamp===null?0:(now-s.clockStamp)/1000;const n=e.advanceClock(s,elapsed);n.clockStamp=now;return n;},
 getTelemetry:s=>({system:s.failed?'FAILED':'NORMAL',systemOnline:!s.failed,cargo:s.carriedItem??'EMPTY',gate:Object.values(s.cabinetPower).filter(Boolean).length+'/3'}),
 getTerminal:()=>({title:'实验室任务',copy:OBJECTIVES[id],rows:[]}),getSoundPosition:(_b,s)=>s.player,
 getFailureMessage:s=>s.lastEvent==='alarm_timeout'?'未及时处置泄漏，任务终止。':'任务余量已耗尽。',
 getDebugState:s=>({revision:REVISION,carriedItem:s.carriedItem,casePhase:s.casePhase,cabinetPower:s.cabinetPower,alarmStatus:s.alarm.status,alarmType:s.alarm.status==='active'?s.alarm.type:null}),
 };
}
