import {applyRobotMovement} from "../../movement.js";
import { LEVEL, STATIONS, SUPPLIES, PREPARATIONS, WALL_COLLIDERS } from "./level.js";
import * as base from "./engine.js";
export const SERIES_REVISION = "clinic-series-v1-r12";
export const REQUEST_TIMEOUT_SECONDS = 120;
export const REQUEST_INTERVAL_SECONDS = 60;
export const SERIES_PROGRESS = Object.freeze({...LEVEL.progress, actionDrainPerSecond:1.5, interactionCost:5});
export const MODES = {
  low: {id:"rf13-02", label:"RF-11-02", name:"基础补给", difficulty:"低等"},
  medium: {id:"rf13", label:"RF-11", name:"开诊准备", difficulty:"中等"},
  high: {id:"rf13-03", label:"RF-11-03", name:"动态诊间服务", difficulty:"高等"},
};
const clone = s => ({...s,player:{...s.player},items:Object.fromEntries(Object.entries(s.items).map(([k,v])=>[k,{...v}])),delivered:[...s.delivered],returned:[...s.returned],prepared:[...s.prepared],requests:s.requests.map(r=>({...r})),furniturePositions:Object.fromEntries(Object.entries(s.furniturePositions??{}).map(([k,v])=>[k,{...v}]))});
export function createClinicEngine(mode="medium") {
 function createInitialState(seed=Math.floor(Math.random()*2147483647)) {
  const s=base.createInitialState(); for(const supply of SUPPLIES)s.items[supply.id].x=-6.20; for(const p of STATIONS)s.items["empty-"+p.id].z=p.z+.20; Object.assign(s,{mode,seed,clock:0,wave:0,nextWaveAt:4,lastRequestAt:null,requests:[],settling:false,furniturePositions:{}});
  if(mode==="high"){
   s.prepared=PREPARATIONS.map(p=>p.id);
   let value=seed>>>0; const random=()=>{value=(1664525*value+1013904223)>>>0;return value/4294967296;};
   const order=[...STATIONS];for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
   s.requests=[...order.slice(0,2).map(p=>({station:p.id,item:p.item,kind:"supply",wave:1})),...order.slice(0,2).reverse().map(p=>({station:p.id,item:"empty-"+p.id,kind:"return",wave:2})),...order.slice(2).map(p=>({station:p.id,item:p.item,kind:"supply",wave:3}))].map((r,i)=>({...r,id:"request-"+(i+1),status:"pending",urgent:i===4,issuedAt:null,completedAt:null}));
  }
  return s;
 }
 function getColliders(s){
  return base.getColliders(s).map(r=>{
   const p=s.furniturePositions?.[r.id],prep=PREPARATIONS.find(v=>v.id===r.id);if(!p||!prep)return r;
   return {id:r.id,minX:p.x-prep.size[0]/2,maxX:p.x+prep.size[0]/2,minZ:p.z-prep.size[2]/2,maxZ:p.z+prep.size[2]/2};
  });
 }
 function isWalkable(s,x,z){
  const r=LEVEL.playerRadius,b=LEVEL.bounds,colliders=getColliders(s);
  const circles=[{x,z,forward:false},{x:x+Math.sin(s.player.yaw)*LEVEL.playerForwardOffset,z:z+Math.cos(s.player.yaw)*LEVEL.playerForwardOffset,forward:true}];
  if(!circles.every(p=>p.x-r>=b.minX&&p.x+r<=b.maxX&&p.z-r>=b.minZ&&p.z+r<=b.maxZ&&!colliders.filter(v=>v.id!==s.movingFurniture&&!(p.forward&&s.items[v.id]?.location==="floor")).some(v=>(p.x-Math.max(v.minX,Math.min(p.x,v.maxX)))**2+(p.z-Math.max(v.minZ,Math.min(p.z,v.maxZ)))**2<r*r)))return false;
  if(s.movingFurniture&&s.furnitureOrigin){
   const prep=PREPARATIONS.find(v=>v.id===s.movingFurniture),p=s.furniturePosition;
   const fx=p.x+x-s.furnitureOrigin.x,fz=p.z+z-s.furnitureOrigin.z,hx=prep.size[0]/2,hz=prep.size[2]/2;
   if(fx-hx<b.minX||fx+hx>b.maxX||fz-hz<b.minZ||fz+hz>b.maxZ)return false;
   if(colliders.filter(v=>v.id!==s.movingFurniture).some(v=>fx+hx>v.minX&&fx-hx<v.maxX&&fz+hz>v.minZ&&fz-hz<v.maxZ))return false;
  }
  return true;
 }
 function nearby(s,p,range=1.12) {
  if(Math.hypot(s.player.x-p.x,s.player.z-p.z)>range)return false;
  for(let i=1;i<30;i++){const x=s.player.x+(p.x-s.player.x)*i/30,z=s.player.z+(p.z-s.player.z)*i/30;if(WALL_COLLIDERS.some(r=>x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ))return false;}
  return true;
 }
 const active = s=>s.requests.filter(r=>r.status==="active");
 function isReady(s) {
  if(s.carriedItem)return false;
  if(mode==="low")return ["exam-a","exam-b"].every(id=>s.delivered.includes(id));
  if(mode==="medium")return base.isReady(s);
  return s.requests.length===6&&s.requests.every(r=>r.status==="completed");
 }
 function getInteraction(s,chosen=null) {
  if(s.complete||s.failed||s.settling)return null;
  if(s.terminalOpen)return {type:"open",point:{...LEVEL.terminal,y:1.05,z:LEVEL.terminal.z+.06},label:mode==="high"?"确认交班":"确认完成"};
  const candidates=[];
  const add=a=>{if(nearby(s,a.point))candidates.push({...a,distance:Math.hypot(s.player.x-a.point.x,s.player.z-a.point.z)});};
  if(s.carriedItem){
   for(const p of STATIONS)add({type:"deliver",station:p.id,point:{x:p.x-.4,y:.9,z:p.z+.20},label:"向"+p.name+"补给"});
   add({type:"return",point:{x:LEVEL.returns.x-.75+Math.min(3,s.returned.length)*.5,y:.9,z:LEVEL.returns.z+.18},label:"归还空周转盒"});
   if(!candidates.length){const p={x:s.player.x+Math.sin(s.player.yaw)*.52,y:0,z:s.player.z+Math.cos(s.player.yaw)*.52};return {type:"drop",point:p,label:"放下物品"};}
  } else {
   for(const item of Object.values(s.items)){
    const canEmpty=mode==="high"?active(s).some(r=>r.kind==="return"&&r.item===item.id):s.delivered.includes(item.station);
    if(["shelf","floor","station"].includes(item.location)&&(item.kind!=="empty"||canEmpty))add({type:"pickup",item:item.id,point:{x:item.x,y:item.y,z:item.z},label:"拿起"+item.name});
   }
   for(const p of PREPARATIONS)if(!s.prepared.includes(p.id))add({type:"prepare",preparation:p.id,point:{x:(s.furniturePositions?.[p.id]?.x??p.x)+(p.id==="chair"?.29:-.29),y:p.id==="chair"?.68:.86,z:s.furniturePositions?.[p.id]?.z??p.z},label:p.name});
   add({type:"terminal",point:{...LEVEL.terminal,y:1.05,z:LEVEL.terminal.z+.06},label:mode==="high"?"检查交班清单":"检查完成清单"});
  }
  if(chosen)return candidates.find(a=>a.type===chosen.type&&a.item===chosen.item&&a.station===chosen.station&&a.preparation===chosen.preparation)??null;
  const score=a=>{const dx=a.point.x-s.player.x,dz=a.point.z-s.player.z;const facing=(Math.sin(s.player.yaw)*dx+Math.cos(s.player.yaw)*dz)/(a.distance||1);return a.distance-.12*facing;};
  return candidates.sort((a,b)=>score(a)-score(b))[0]??null;
 }
 function tick(s,seconds) {
  if(s.complete||s.failed)return s;
  const n=clone(s);n.clock+=Math.max(0,Number.isFinite(seconds)?seconds:0);
  if(mode!=="high")return n;
  const expired=active(n).find(r=>n.clock-r.issuedAt>=REQUEST_TIMEOUT_SECONDS);
  if(expired){n.failed=true;n.failureReason=expired.urgent?"urgent_timeout":"request_timeout";n.expiredRequestId=expired.id;n.terminalOpen=false;n.lastEvent=n.failureReason;return n;}
  if(n.wave<3&&!active(n).length&&n.requests.filter(r=>r.wave<=n.wave).every(r=>r.status==="completed")&&n.nextWaveAt===null)n.nextWaveAt=n.clock+8;
  // All calls share the minimum interval, including urgent calls and batch boundaries.
  // Issue at most one call per update so a delayed browser frame never bunches calls.
  const canIssue=n.lastRequestAt===null||n.clock-n.lastRequestAt>=REQUEST_INTERVAL_SECONDS;
  const issue=r=>{r.status="active";r.issuedAt=n.clock;n.lastRequestAt=n.clock;n.lastEvent=r.urgent?"urgent_request":"clinic_request";};
  if(canIssue&&n.nextWaveAt!==null&&n.clock>=n.nextWaveAt){
   n.wave++;const pair=n.requests.filter(r=>r.wave===n.wave);issue(pair[0]);pair[1].releaseAt=n.clock+REQUEST_INTERVAL_SECONDS;n.nextWaveAt=null;
  }else if(canIssue){
   const pending=n.requests.find(r=>r.status==="pending"&&r.wave===n.wave&&r.releaseAt!=null&&n.clock>=r.releaseAt);
   if(pending)issue(pending);
  }
  return n;
 }
 function interact(s,selected=null) {
  if(s.complete||s.failed||s.settling)return s;
  const a=getInteraction(s,selected);const n=clone(s);n.lastEvent="empty_interaction";
  if(!a)return n;
  n.interactions++;
  n.progress=Math.max(0,n.progress-SERIES_PROGRESS.interactionCost);
  if(n.progress<=0){n.failed=true;n.failureReason="reserve";n.lastEvent="progress_depleted";return n;}
  if(a.type==="pickup"){n.carriedItem=a.item;n.items[a.item].location="carried";n.lastEvent="battery_collected";}
  else if(a.type==="deliver"){
   const p=STATIONS.find(p=>p.id===a.station);
   const request=active(n).find(r=>r.kind==="supply"&&r.station===a.station&&r.item===s.carriedItem);
   if(s.carriedItem!==p.item||n.delivered.includes(p.id)||(mode==="high"&&!request)){n.lastEvent="wrong_station";return n;}
   Object.assign(n.items[s.carriedItem],{location:"delivered",...a.point});n.delivered.push(p.id);n.carriedItem=null;n.lastEvent="power_restored";
   if(request){request.status="completed";request.completedAt=n.clock;n.lastEvent="request_completed";}
  }else if(a.type==="return"){
   const request=active(n).find(r=>r.kind==="return"&&r.item===s.carriedItem);
   if(n.items[s.carriedItem].kind!=="empty"||(mode==="high"&&!request)){n.lastEvent="wrong_return";return n;}
   Object.assign(n.items[s.carriedItem],{location:"returned",...a.point});n.returned.push(s.carriedItem);n.carriedItem=null;n.lastEvent="power_restored";
   if(request){request.status="completed";request.completedAt=n.clock;n.lastEvent="request_completed";}
  }else if(a.type==="prepare"){n.prepared.push(a.preparation);if(!isWalkable(n,n.player.x,n.player.z)){n.prepared.pop();n.lastEvent="move_blocked";return n;}n.lastEvent="clinic_prepared";}
  else if(a.type==="drop"){
   const p=a.point;
   if(!isWalkable({...n,player:{...n.player,yaw:0}},p.x,p.z)){n.lastEvent="drop_blocked";return n;}
   Object.assign(n.items[s.carriedItem],{location:"floor",...p});n.carriedItem=null;n.lastEvent="battery_dropped";
  }else if(a.type==="terminal"){if(!isReady(n)){n.lastEvent="terminal_not_ready";return n;}n.terminalOpen=true;n.lastEvent="terminal_opened";}
  else if(a.type==="open"){if(!isReady(n))return n;n.complete=true;n.terminalOpen=false;n.lastEvent="clinic_opened";}
  n.progress=Math.min(100,n.progress+(["power_restored","request_completed","clinic_prepared","clinic_opened"].includes(n.lastEvent)?SERIES_PROGRESS.reward:0));
  if(n.progress<=0){n.failed=true;n.failureReason="reserve";n.lastEvent="progress_depleted";}
  return n;
 }
 function updateMovement(s,input={},dt){
  if(s.complete||s.failed||s.terminalOpen)return s;
  const n=clone(s),delta=Math.min(.05,Math.max(0,dt));const movement=applyRobotMovement(n,s,input,delta,LEVEL,isWalkable);n.elapsed+=delta;n.motion=movement.motionTurning?"turning":s.carriedItem?"carrying":movement.translating?"moving":"idle";
  if(movement.translating&&input.drain!==false)n.progress=Math.max(0,n.progress-SERIES_PROGRESS.actionDrainPerSecond*delta);
  if(n.progress<=0){n.failed=true;n.failureReason="reserve";n.lastEvent="progress_depleted";}
  if(n.movingFurniture)n.furniturePositions[n.movingFurniture]={x:n.furniturePosition.x+n.player.x-n.furnitureOrigin.x,z:n.furniturePosition.z+n.player.z-n.furnitureOrigin.z};
  return n;
 }
 function finishFurniture(s,id){
  const p=s.furniturePositions?.[id],prep=PREPARATIONS.find(v=>v.id===id);
  if(!p||Math.hypot(p.x-prep.destination.x,p.z-prep.destination.z)>.04||s.prepared.includes(id))return s;
  return {...s,movingFurniture:null,prepared:[...s.prepared,id],interactions:s.interactions+1,lastEvent:"clinic_prepared",progress:Math.min(100,s.progress+SERIES_PROGRESS.reward-SERIES_PROGRESS.interactionCost)};
 }
 function getObjective(s){
  if(s.failed)return {title:["urgent_timeout","request_timeout"].includes(s.failureReason)?"诊间请求超时":"任务失败",detail:["urgent_timeout","request_timeout"].includes(s.failureReason)?"请求未在 120 秒内完成，请重新开始。":"任务余量耗尽。"};
  if(s.complete)return {title:"任务完成",detail:mode==="high"?"六个请求已处理，交班完成。":"诊所准备完成。"};
  if(mode==="high")return {title:"完成动态诊间服务并交班",detail:active(s).map(r=>(r.urgent?"【加急】":"")+STATIONS.find(p=>p.id===r.station).name+" · "+(r.kind==="return"?"回收空盒":SUPPLIES.find(p=>p.id===r.item).name)).join("；")||(isReady(s)?"前往前台确认交班":"等待新的诊间请求")};
  return {title:mode==="low"?"完成两间诊室补给并确认": "完成社区诊所开诊任务",detail:mode==="low"?"手套盒送诊室一，纱布盒送诊室二，最后到前台确认。":base.getObjective(s).detail};
 }
 return {createInitialState,finishFurniture,cloneState:clone,isWalkable,nearby,isReady,getInteraction,interact,updateMovement,updateEnvironment:tick,getObjective,closeTerminal:s=>({...s,terminalOpen:false}),activeRequests:active};
}
