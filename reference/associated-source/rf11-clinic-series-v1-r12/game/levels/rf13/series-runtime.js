import {LEVEL as BASE, STATIONS} from "./level.js";
import {createClinicEngine,MODES,SERIES_REVISION,SERIES_PROGRESS} from "./series-engine.js";
import {createSeriesScene,syncSeriesVisuals,prepareClinicView} from "./series-scene.js";
import {createClinicCargoModel} from "./scene.js";
import {createClinicAnimation} from "./series-animation.js";
export function createRuntime(mode){
 const e=createClinicEngine(mode),config=MODES[mode];let clock=null;
 const ui={id:config.id,levelLabel:config.label,brand:"社区诊所 · "+config.name,unit:config.label+" · "+config.difficulty+"难度",systemLabel:"诊所",cargoLabel:"携带",gateLabel:"清单",startKicker:config.label+" / "+config.difficulty+"难度",startTitle:"社区诊所<br />"+config.name,startCopy:mode==="high"?"处理六个动态请求并交班；每个请求须在120秒内完成，超时失败。":"完成补给并在前台确认。",completeKicker:"CLINIC COMPLETE",completeTitle:config.name+"完成",completeCopy:mode==="high"?"六个动态请求均已完成，交班完成。":"本关诊所任务已完成。",terminalHeading:"社区诊所 / 服务清单"};
 const eventMessages={battery_collected:"已拿起物品",battery_dropped:"物品已放下",power_restored:"用品交接完成",wrong_station:"此工位不接收当前物品，或当前没有对应请求",wrong_return:"请按当前任务归还空周转盒",move_blocked:"归位通道被阻挡",drop_blocked:"此处不能放置",clinic_prepared:"家具归位完成",terminal_not_ready:"任务尚未完成，请检查清单",terminal_opened:"清单检查通过，再按 F 确认",clinic_opened:"任务完成",empty_interaction:"请靠近要操作的物品",progress_depleted:"任务余量耗尽",clinic_request:"有新的诊间服务请求",urgent_request:"收到加急请求，请优先处理",request_completed:"诊间请求处理完成",urgent_timeout:"加急请求超时，任务失败",request_timeout:"诊间请求超时，任务失败"};
 return {...e,interact(s,selected){const now=performance.now();if(clock!==null){s=e.updateEnvironment(s,Math.max(0,(now-clock)/1000));clock=now;}return e.interact(s,selected);},LEVEL:{...BASE,progress:SERIES_PROGRESS,id:config.id,seriesRevision:SERIES_REVISION},ui,camera:{position:[0,18.5,16],lookAt:[0,.6,0],fov:43},
 createInitialState(seed){clock=null;return e.createInitialState(seed);},
 updateEnvironment(s,dt){const now=performance.now(),elapsed=clock===null?dt:Math.max(0,(now-clock)/1000);clock=now;const n=e.updateEnvironment(s,elapsed);
 if(n.requests.some((r,i)=>r.status==="active"&&s.requests[i]?.status!=="active")){if(typeof Audio!=="undefined"){const sound=new Audio("/local-assets/levels/rf13/clinic-series-v1/request-chime.mp3");sound.volume=.5;sound.play().catch(()=>{});}}
 return n;},
 resetClock(){clock=null;},
 createScene:createSeriesScene,createCargoModel:createClinicCargoModel,syncVisuals:syncSeriesVisuals,syncRobotCargo(robot){robot.userData.rackPayload.visible=false;},
 prepareView:prepareClinicView,createInteractionAnimation:createClinicAnimation,isCarrying:s=>Boolean(s.carriedItem),
 getTelemetry(s){return {system:s.failed?"FAILED":s.complete?"READY":mode==="high"?"SERVICE":"SETUP",systemOnline:e.isReady(s),cargo:s.carriedItem?s.items[s.carriedItem].name:"EMPTY",gate:mode==="high"?s.requests.filter(r=>r.status==="completed").length+"/6":mode==="low"?s.delivered.filter(id=>["exam-a","exam-b"].includes(id)).length+"/2":s.delivered.length+"/4 · "+s.returned.length+"/4 · "+s.prepared.length+"/2"};},
 getProgressSteps:s=>[{label:config.name,done:e.isReady(s),active:!e.isReady(s)},{label:"前台确认",done:s.complete,active:e.isReady(s)}],
 getTerminal:s=>({title:mode==="high"?"交班清单":"任务清单",copy:"按 F 确认，Esc 返回。",rows:[["补给",String(s.delivered.length)],["回收",String(s.returned.length)],["任务",e.isReady(s)?"已完成":"未完成"]]}),
 getFailureMessage:s=>["urgent_timeout","request_timeout"].includes(s.failureReason)?"诊间请求未在 120 秒内完成，本次诊间服务失败。":"任务余量耗尽，请重新开始。",
 eventMessages,audio:{assets:{},eventSounds:{},volume:{}},getSoundPosition:(_b,s)=>s.player,
 getDebugState:s=>({carriedItem:s.carriedItem,delivered:s.delivered,returned:s.returned,prepared:s.prepared,clinicMode:s.mode,clinicRevision:SERIES_REVISION,activeRequests:e.activeRequests(s).map(r=>({id:r.id,station:r.station,kind:r.kind,urgent:r.urgent})),requestCount:s.requests.filter(r=>r.status==="completed").length}),
 };
}
