import * as THREE from "three";
import {createLeakEngine,OBJECTIVES,REVISION} from "./series-engine.js";
import {createLeakSeriesScene,syncLeakSeries,prepareLeakView} from "./series-scene.js";
import {createLeakAnimation} from "./series-animation.js";
export function createLeakRuntime(id){
 const e=createLeakEngine(id);return {...e,
 ui:{id,brand:"HOME LEAK RESPONSE",unit:id.toUpperCase()+" · HOUSEHOLD MAINTENANCE",systemLabel:"WATER",cargoLabel:"TOOL",gateLabel:"BUCKET",startKicker:id.toUpperCase(),startTitle:"LEAK<br />RESPONSE",startCopy:OBJECTIVES[id],completeKicker:"LEAK RESOLVED",completeTitle:"漏水已处理",completeCopy:OBJECTIVES[id],terminalHeading:"家庭漏水处理"},
 camera:{position:[0,15.5,4.5],lookAt:[0,.3,0],fov:38},rendering:{pixelRatioCap:1},audio:{assets:{},eventSounds:{},volume:{}},
 eventMessages:{picked_up:"已拿起工具",valve_closed:"阀门已关闭",bucket_placed:"水桶已放置",puddle_cleaned:"积水已清理",mop_pass:"已清理部分积水",tool_returned:"工具已归位",dropped:"已放下工具",sequence_required:"请先关闭阀门",blocked_drop:"此处无法放置",leak_resolved:"漏水处理完成",progress_depleted:"状态余量耗尽"},
 prepareView:prepareLeakView,createScene:createLeakSeriesScene,syncVisuals:syncLeakSeries,createInteractionAnimation:createLeakAnimation,
 createCargoModel:()=>new THREE.Group(),syncRobotCargo:r=>{r.userData.rackPayload.visible=false;},
 isCarrying:s=>Boolean(s.carriedItem),getProgressSteps:()=>[],
 getTelemetry:s=>({system:s.valveClosed?"已止水":"漏水中",systemOnline:s.valveClosed,cargo:({wrench:"扳手",mop:"拖把",bucket:"水桶"})[s.carriedItem]??"空手",gate:s.puddleClean?"地面已清理":"地面有积水"}),
 getTerminal:()=>({title:"家庭漏水处理",copy:OBJECTIVES[id],rows:[]}),
 getSoundPosition:(_b,s)=>s.player,getDebugState:s=>({...s,revision:REVISION}),
 };
}
