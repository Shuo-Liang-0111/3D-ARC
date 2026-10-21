import * as THREE from "three";
import { createHotelEngine } from "./series-engine.js";
import { createHotelSeriesScene, syncHotelSeries } from "./series-scene.js";
import { createHotelAnimation } from "./series-animation.js";
import { objectives, REVISION, SLOTS } from "./series-layout.js";
export function createHotelRuntime(id){
 const engine=createHotelEngine(id);
 return {...engine,slots:SLOTS,ui:{id,brand:"HOTEL ROOM SERVICE",unit:id.toUpperCase()+" · GUEST SERVICES",systemLabel:"ROOM",cargoLabel:"CARRYING",gateLabel:"HANDOVER",startKicker:"LEVEL "+id.toUpperCase()+" / HOTEL ROOM",startTitle:"ROOM<br />SERVICE",startCopy:objectives[id],completeKicker:"ROOM SERVICE COMPLETE",completeTitle:"客房整理完成",completeCopy:objectives[id],terminalHeading:"HOTEL STATUS"},
 rendering:{pixelRatioCap:1},camera:{position:[0,24.5,10.5],lookAt:[0,.3,0],fov:36},audio:{assets:{},eventSounds:{},volume:{}},
 eventMessages:{picked_up:"已拿起物品",placed:"已放下物品",delivered:"旧物已正确回收",restocked:"干净用品已摆放",wrong_target:"物品与回收容器不匹配",slot_unavailable:"该位置尚未腾空、已有用品或类型不匹配",water_on:"已开启水龙头",water_off:"已关闭水龙头",draining:"已开启排水",water_unsuitable:"水量不合适，或水龙头仍开启",cup_in_sink:"水杯已放入台盆",cup_clean:"杯具已清洗",gripped:"已扶住家具",released:"已松手",parked:"家具已归位",path_blocked:"前方受阻",room_incomplete:"客房尚未满足交付条件",room_ready:"客房任务完成",progress_depleted:"任务余量耗尽",blocked_drop:"此处无法安全放置"},
 createScene:createHotelSeriesScene,syncVisuals:syncHotelSeries,createInteractionAnimation:createHotelAnimation,
 createCargoModel:()=>new THREE.Group(),syncRobotCargo(robot){robot.userData.rackPayload.visible=false;},
 isCarrying:s=>Boolean(s.carriedItem),getProgressSteps:()=>[],
 getTelemetry:s=>({system:s.complete?"READY":"IN SERVICE",systemOnline:s.complete,cargo:s.carriedItem?(s.items[s.carriedItem].type==="towel"?"毛巾":s.items[s.carriedItem].type==="cup"?"水杯":"垃圾"):s.attachment==="cart"?"清洁车":s.attachment==="chair"?"椅子":"EMPTY",gate:s.complete?"COMPLETE":"PENDING"}),
 getTerminal:()=>({title:"客房状态",copy:objectives[id],rows:[]}),getSoundPosition:(_a,s)=>s.player,
 getDebugState:s=>({revision:REVISION,items:s.items,carriedItem:s.carriedItem,attachment:s.attachment,water:s.sink.water,faucet:s.sink.faucet,sink:s.sink,slots:s.slots,furniture:s.furniture}),
 };
}
