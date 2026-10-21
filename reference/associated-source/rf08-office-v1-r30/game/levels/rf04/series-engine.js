import { advanceVacuum } from "./vacuum-navigation.js";
import { LEVEL as BASE, CLOTHING_TYPES as TYPES } from "./level.js";
import { createInitialState as initial, cloneState as cloneBase } from "./engine.js";
import { applyRobotMovement } from "../../movement.js";
import { REVISION, SHARED_COLLIDERS, DRY_SECONDS, VACUUM, DOCK, BAYS, STORAGE, LABELS, dist, clearCircle, lineClear } from "./series-layout.js";

export function createLaundryEngine(id) {
 const advanced=id!=="rf04", dynamic=id==="rf04-3";
 const LEVEL=Object.freeze({...BASE,id,interactionRange:1.25,staticColliders:SHARED_COLLIDERS,dynamic,advanced});
 function createInitialState() { return {...initial(),revision:REVISION,levelId:id,dryElapsed:0,laundryHung:false,settling:false,
   vacuum:{...(dynamic?VACUUM.start:DOCK),mode:dynamic?"roaming":"docked",turn:0},actionTarget:null}; }
 function clone(s) {return {...cloneBase(s),vacuum:{...s.vacuum}};}
 function isWalkable(s,x,z,r=LEVEL.playerRadius) {
  if(!clearCircle(x,z,r))return false;
  if(s.carriedItem) {
   const f=s.carriedItem==="vacuum"?.32:.30, radius=s.carriedItem==="vacuum"?.19:.24;
   if(!clearCircle(x+Math.sin(s.player.yaw)*f,z+Math.cos(s.player.yaw)*f,radius))return false;
  }
  return !["roaming","stopped"].includes(s.vacuum.mode) || s.actionTarget==="vacuum" || Math.hypot(x-s.vacuum.x,z-s.vacuum.z)>r+VACUUM.radius;
 }
 function advance(s,dt) {
  if(s.washerPhase==="washing") { s.washElapsed=Math.min(LEVEL.washDuration,s.washElapsed+dt);
   if(s.washElapsed>=LEVEL.washDuration){s.washerPhase="done";s.lastEvent="washer_finished";s.progress=Math.min(100,s.progress+15);}
  }
  if(s.laundryHung&&advanced) s.dryElapsed=Math.min(DRY_SECONDS,s.dryElapsed+dt);
  advanceVacuum(s.vacuum,s.player,dt);
 }
 function updateMovement(s,input={},seconds) {
  const n=clone(s),dt=Math.min(.05,Math.max(0,seconds));
  if(n.complete||n.failed)return n;
  n.elapsed+=dt;
  const m=applyRobotMovement(n,s,input,dt,LEVEL,isWalkable);
  if(m.active&&input.drain!==false&&m.translating)n.progress=Math.max(0,n.progress-LEVEL.progress.actionDrainPerSecond*dt);
  n.motion=m.motionTurning?"turning":m.translating?"moving":n.carriedItem?"carrying":"idle";
  if(n.progress<=0){n.failed=true;n.lastEvent="progress_depleted";}
  return n;
 }
 function pointFor(s,a) {
  const t=a.clothingType??s.carriedItem;
  if(a.type==="vacuum")return {...s.vacuum,y:.055};
  if(a.type==="dock")return {...DOCK,y:DOCK.y+.05};
  if(a.type==="store")return {...BAYS[a.bay],x:BAYS[a.bay].x-.12,z:STORAGE.z-.12};
  if(a.type==="dry-clothing"||a.type==="dry-wait")return {x:LEVEL.dryingRack.modelX+(TYPES.indexOf(t)-1)*.76,z:LEVEL.dryingRack.modelZ+.22,y:1.15};
  if(a.type==="clothing")return {...s.clothes[t],y:.045};
  if(a.type==="wet-batch")return {...s.wetBatch,y:.06};
  if(a.type==="drying-rack")return {x:LEVEL.dryingRack.modelX,z:LEVEL.dryingRack.modelZ+.22,y:1.15};
  if(a.type.startsWith("washer"))return {x:LEVEL.washer.modelX,z:LEVEL.washer.modelZ+.40,y:a.type==="washer-start"?.74:.42};
  if(a.type==="drop")return {x:s.player.x+Math.sin(s.player.yaw)*.58,z:s.player.z+Math.cos(s.player.yaw)*.58,y:s.carriedItem==="vacuum"?.055:.045};
  return {x:s.player.x,z:s.player.z,y:0};
 }
 function candidates(s) {
  const list=[];
  const add=(a)=>{const p=pointFor(s,a),d=dist(s.player,p);if(d<=LEVEL.interactionRange&&lineClear(s.player,a.type==="store"?{...p,z:BAYS[a.bay].z}:p,.015))list.push({...a,point:p,distance:d});};
  if(!s.carriedItem) {
   for(const type of TYPES){
    const c=s.clothes[type];
    if(["living-room","ground"].includes(c.location))add({type:"clothing",clothingType:type,label:"拿起"+LABELS[type]});
    if(advanced&&c.location==="hung")add({type:s.dryElapsed>=DRY_SECONDS?"dry-clothing":"dry-wait",clothingType:type,label:s.dryElapsed>=DRY_SECONDS?"收取"+LABELS[type]:"等待晾干",point:pointFor(s,{type:"dry-clothing",clothingType:type})});
   }
   if(s.wetBatch)add({type:"wet-batch",label:"拿起湿衣物"});
   if(s.washerPhase==="ready")add({type:"washer-start",label:"启动洗衣机"});
   if(s.washerPhase==="washing")add({type:"washer-busy",label:"洗涤中"});
   if(s.washerPhase==="done")add({type:"washer-unload",label:"取出湿衣物"});
   if(dynamic&&["roaming","stopped"].includes(s.vacuum.mode))add({type:"vacuum",label:"抓起扫地机器人"});
  } else if(s.carriedItem==="vacuum")add({type:"dock",label:"放回充电区"});
  else if(s.carriedItem==="wet-batch")add({type:"drying-rack",label:"晾晒衣物"});
  else if(s.clothes[s.carriedItem].clean)for(const type of TYPES)add({type:"store",bay:type,clothingType:s.carriedItem,label:"放入"+LABELS[type]+"格"});
  else add({type:"washer-load",clothingType:s.carriedItem,label:"放入洗衣机"});
  return list.sort((a,b)=>a.distance-b.distance);
 }
 function getInteraction(s,requested=null) {
  if(s.complete||s.failed)return null;
  const list=candidates(s);
  if(requested&&typeof requested==="object"){
   return list.find(a=>a.type===requested.type&&a.clothingType===requested.clothingType&&a.bay===requested.bay) ??
    (requested.type==="drop"&&s.carriedItem?{type:"drop",point:pointFor(s,{type:"drop"}),label:"放下"}:null);
  }
  // Aim and distance distinguish adjacent compartments.
  list.sort((a,b)=>{
   const score=c=>c.distance+.45*(1-Math.cos(Math.atan2(c.point.x-s.player.x,c.point.z-s.player.z)-s.player.yaw));
   return score(a)-score(b);
  });
  return list[0]??(s.carriedItem?{type:"drop",point:pointFor(s,{type:"drop"}),label:"放下"}:null);
 }
 function beginInteraction(s,requested) {
  const a=getInteraction(s,requested);
  if(a?.type!=="vacuum")return s;
  const n=clone(s);n.vacuum.mode="stopped";return n;
 }
 function interact(s,requested) {
  const n=clone(s),a=getInteraction(s,requested);
  if(!a){n.lastEvent="empty_interaction";return n;}
  if(a.type==="washer-busy"||a.type==="dry-wait"){n.lastEvent=a.type;return n;}
  if(a.type==="store"&&a.bay!==s.carriedItem){n.lastEvent="wrong_storage";return n;}
  if(a.type==="drop"&&!clearCircle(a.point.x,a.point.z,s.carriedItem==="vacuum"?.20:.25)){n.lastEvent="blocked_drop";return n;}
  n.interactions++;n.progress=Math.max(0,n.progress-5);n.lastEvent=a.type;
  const t=a.clothingType??s.carriedItem;
  switch(a.type){
   case "clothing": n.carriedItem=t;n.clothes[t]={...n.clothes[t],location:"carried"};if(!n.rewardedPickups[t]){n.rewardedPickups[t]=true;n.progress=Math.min(100,n.progress+30);}break;
   case "washer-load": n.clothes[t]={type:t,location:"washer"};n.carriedItem=null;n.progress=100;if(TYPES.every(t=>n.clothes[t].location==="washer"))n.washerPhase="ready";break;
   case "washer-start": n.washerPhase="washing";n.washElapsed=0;break;
   case "washer-unload":n.carriedItem="wet-batch";n.washerPhase="unloaded";for(const t of TYPES)n.clothes[t]={type:t,location:"wet-carried",clean:true};n.progress=Math.min(100,n.progress+15);break;
   case "wet-batch":n.carriedItem="wet-batch";n.wetBatch=null;for(const t of TYPES)n.clothes[t].location="wet-carried";break;
   case "drying-rack":n.carriedItem=null;n.laundryHung=true;n.dryElapsed=0;for(const t of TYPES)n.clothes[t]={type:t,location:"hung",clean:true};n.progress=100;break;
   case "dry-clothing":n.carriedItem=t;n.clothes[t].location="carried";n.clothes[t].clean=true;break;
   case "store":n.clothes[t].location="stored";n.carriedItem=null;n.progress=Math.min(100,n.progress+15);break;
   case "vacuum":n.vacuum.mode="carried";n.carriedItem="vacuum";break;
   case "dock":n.vacuum={...n.vacuum,...DOCK,mode:"docked"};n.carriedItem=null;n.progress=Math.min(100,n.progress+15);break;
   case "drop":{
    const p=a.point;
    if(t==="vacuum")n.vacuum={...n.vacuum,x:p.x,z:p.z,mode:"roaming"};
    else if(t==="wet-batch"){n.wetBatch={x:p.x,z:p.z};for(const type of TYPES)n.clothes[type].location="wet-ground";}
    else n.clothes[t]={...n.clothes[t],location:"ground",x:p.x,z:p.z};
    n.carriedItem=null;break;
   }
  }
  n.complete=advanced?TYPES.every(t=>n.clothes[t].location==="stored")&&(!dynamic||n.vacuum.mode==="docked"):n.laundryHung;
  n.motion=n.carriedItem?"carrying":"idle";
  if(n.progress<=0&&!n.complete){n.failed=true;n.lastEvent="progress_depleted";}
  return n;
 }
 function getObjective(s){return {title:s?.complete?"家务完成":dynamic?"收好衣物，并将扫地机器人放回充电区":advanced?"洗净、晾干并分类收好三件衣物":"完成衣物洗涤与晾晒",detail:"靠近按 F 取放；携带时用移动键行走。",step:1};}
 function updateEnvironment(s,dt){const n=clone(s);if(!n.complete&&!n.failed)advance(n,Math.min(.05,Math.max(0,dt)));return n;}
 return {LEVEL,updateEnvironment,createInitialState,cloneState:clone,updateMovement,isWalkable,getInteraction,beginInteraction,interact,pointFor,getObjective,closeTerminal:clone};
}
