import { createWind, advanceWind, animateWindow, windowPoint } from "./series-wind.js";
import { createTissues, advanceTissue, tissueCatchable, tissuesDone, distance3, TISSUE_IDS } from "./series-tissues.js";
import { applyRobotMovement } from "../../movement.js";
import { REVISION, makeLevel, DIRTY, STOCK, SLOTS, TARGETS, EXIT, FURNITURE, objectives, distance, furnitureRect, furniturePoint, standForFurniture, itemPose } from "./series-layout.js";
const clone=o=>structuredClone(o), clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const overlaps=(x,z,r,q)=>Math.hypot(x-clamp(x,q.minX,q.maxX),z-clamp(z,q.minZ,q.maxZ))<r-1e-6;
const rectOverlap=(a,b)=>a.minX<b.maxX-1e-5&&a.maxX>b.minX+1e-5&&a.minZ<b.maxZ-1e-5&&a.maxZ>b.minZ+1e-5;
const delivered=s=>["towel","cup","trash"].every(id=>s.delivered[id]);
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function createHotelEngine(id){
 const LEVEL=makeLevel(id),tissueIds=id==="rf05-3"?TISSUE_IDS:[];
 function createInitialState(options={}){return {revision:REVISION,player:{...LEVEL.playerStart},items:{...(tissueIds.length?createTissues(options?.seed):{}),...Object.fromEntries([...Object.entries(DIRTY).map(([k,v])=>[k,{...v,location:"room"}]),...Object.entries(STOCK).map(([k,v])=>[k,{...v,location:"stock"}])])},furniture:clone(FURNITURE),carriedItem:null,attachment:null,delivered:{},slots:{},rewarded:{},wind:createWind(id==="rf05-3"),catchHand:null,catchPending:null,exitConfirmed:false,complete:false,failed:false,settling:false,progress:100,elapsed:0,interactions:0,motion:"idle",lastEvent:"hotel_started"};}
 function isWalkable(s,x,z,r=LEVEL.playerRadius,ignore=null){
  const b=LEVEL.bounds;if(x-r<b.minX||x+r>b.maxX||z-r<b.minZ||z+r>b.maxZ)return false;
  if(LEVEL.staticColliders.some(q=>overlaps(x,z,r,q)))return false;
  return !Object.entries(s.furniture).some(([k,f])=>k!==ignore&&overlaps(x,z,r,furnitureRect(f)));
 }
 function furnitureClear(s,key,f){
  const q=furnitureRect(f,.018),b=LEVEL.bounds;
  if(q.minX<b.minX||q.maxX>b.maxX||q.minZ<b.minZ||q.maxZ>b.maxZ)return false;
  return !LEVEL.staticColliders.some(r=>rectOverlap(q,r))&&!Object.entries(s.furniture).some(([k,other])=>k!==key&&rectOverlap(q,furnitureRect(other)));
 }
 function payloadPenalty(s){
  if(!s.carriedItem)return 0;
  const towel=s.items[s.carriedItem].type==="towel",yaw=s.player.yaw;
  const center={x:s.player.x+Math.sin(yaw)*.32+Math.cos(yaw)*(towel?0:-.15),z:s.player.z+Math.cos(yaw)*.32-Math.sin(yaw)*(towel?0:-.15)};
  const radius=towel?.34:s.items[s.carriedItem].type==="tissue"?.17:.085;
  return LEVEL.staticColliders.filter(q=>/wall|partition|wardrobe|tv-console/.test(q.id)).reduce((sum,q)=>{
   const d=Math.hypot(center.x-clamp(center.x,q.minX,q.maxX),center.z-clamp(center.z,q.minZ,q.maxZ));return sum+Math.max(0,radius-d);
  },0);
 }
 function depleted(n){if(n.progress<=0&&!n.complete){n.failed=true;n.motion="idle";n.lastEvent="progress_depleted";}return n;}
 function updateMovement(s,input={},delta=0){
  const n=clone(s),dt=clamp(delta,0,.05);n.elapsed+=dt;if(s.complete||s.failed)return n;
  if(s.attachment){
   const key=s.attachment,old=s.furniture[key],previous=s.player,proposal=clone(s);
   applyRobotMovement(proposal,s,input,dt,{...LEVEL,moveSpeed:Math.min(.5,LEVEL.moveSpeed),turnSpeed:Math.min(.7,LEVEL.turnSpeed)},()=>true);
   const da=angle(proposal.player.yaw,previous.yaw),dx=old.x-previous.x,dz=old.z-previous.z;
   const f={...old,x:proposal.player.x+Math.cos(da)*dx+Math.sin(da)*dz,z:proposal.player.z-Math.sin(da)*dx+Math.cos(da)*dz,yaw:old.yaw+da};
   const trial={...n,furniture:{...n.furniture,[key]:f},player:proposal.player};
   if(furnitureClear(trial,key,f)&&isWalkable(trial,proposal.player.x,proposal.player.z,LEVEL.playerRadius,key)){n.player=proposal.player;n.furniture[key]=f;n.lastEvent="furniture_moving";}
   else n.lastEvent="path_blocked";
   n.motion=(input.move||input.strafe||input.turn)?"moving":"idle";
  }else{
   const m=applyRobotMovement(n,s,input,dt,LEVEL,isWalkable);
   n.motion=m.active?(m.motionTurning?"turning":s.carriedItem?"carrying":"moving"):s.carriedItem?"carrying":"idle";
  }
  if(payloadPenalty(n)>payloadPenalty(s)+1e-6){n.player={...s.player};n.lastEvent="path_blocked";}
  if(input.drain!==false&&(input.move||input.strafe))n.progress=Math.max(0,s.progress-LEVEL.progress.actionDrainPerSecond*dt);
  return depleted(n);
 }
 function updateEnvironment(s,delta){
  if(s.complete||s.failed)return s;const dt=clamp(delta,0,.05),n=clone(s);advanceWind(n.wind,dt);
  const colliders=[...LEVEL.staticColliders,...Object.values(s.furniture).map(f=>furnitureRect(f))];
  for(const key of tissueIds)advanceTissue(n.items[key],n.wind,dt,LEVEL.moveSpeed,colliders,LEVEL.bounds,LEVEL.playerRadius+.02);
  return n;
 }
 function candidates(s){
  if(s.complete||s.failed||s.settling)return [];

  if(s.attachment){const key=s.attachment;return [{type:"release",key,point:furniturePoint(s.furniture[key],0,s.furniture[key].handleY,-s.furniture[key].handleBack)}];}
  const list=[],add=(type,point,extra={})=>{if(distance(s.player,point)<=LEVEL.interactionRange)list.push({type,point,...extra});};
  if(s.carriedItem){
   const key=s.carriedItem,item=s.items[key];
   if(key in DIRTY||item.type==="tissue"){for(const[k,p]of Object.entries(TARGETS))add("deliver",p,{item:key,target:k});}
   else for(const[slot,p]of Object.entries(SLOTS))add("restock",p,{item:key,slot});
   if(!list.length)add("drop",{x:s.player.x+Math.sin(s.player.yaw)*.52,y:.025,z:s.player.z+Math.cos(s.player.yaw)*.52},{item:key});
  }else{
   for(const[key,item]of Object.entries(s.items)){
    // Only the exposed top towel can be lifted out of the stock stack.
    const covered=item.location==="stock"&&item.type==="towel"&&Object.entries(s.items).some(([other,t])=>other!==key&&t.type==="towel"&&t.location==="stock"&&t.y>item.y);
    if(!covered&&["room","floor","stock"].includes(item.location))add("pickup",itemPose(key,s),{item:key});
   }
   if(!s.wind.latched)add("window-close",windowPoint(s.wind));
   for(const key of tissueIds){
    const t=s.items[key];
    if(tissueCatchable(s,t)||s.catchPending===key&&t.location==="catching")add("tissue-catch",t,{item:key});
   }
   for(const[key,f]of Object.entries(s.furniture)){const stand=standForFurniture(f);if(distance(s.player,stand)<=1.1)add("grip",furniturePoint(f,0,f.handleY,-f.handleBack),{key,stand});}
   add("exit",EXIT);
  }
  return list;
 }
 function getInteraction(s,selected){
  let list=candidates(s);
  if(selected&&typeof selected==="object"){return list.find(c=>c.type===selected.type&&c.item===selected.item&&c.target===selected.target&&c.slot===selected.slot&&c.key===selected.key)||null;}
  // Facing selects overlapping controls/stock without demanding exact alignment.
  const score=c=>(c.type==="tissue-catch"?-2:0)+distance(s.player,c.point)+.33*Math.abs(angle(Math.atan2(c.point.x-s.player.x,c.point.z-s.player.z),s.player.yaw));
  list.sort((a,b)=>score(a)-score(b));return list[0]??null;
 }
 function reward(s,key,amount=15){if(!s.rewarded[key]){s.rewarded[key]=true;s.progress=Math.min(100,s.progress+amount);}}
 function ready(s){
  if(["window-close","tissue-catch"].includes(s.actionTarget))return false;
  if(!delivered(s))return false;
  if(id==="rf05")return true;
  if(!Object.keys(SLOTS).every(k=>s.slots[k]))return false;
  if(id==="rf05-2")return true;
  return s.wind.latched&&tissuesDone(s)&&["cart","chair"].every(k=>parked(s.furniture[k]));
 }
 function parked(f){return distance(f,f.target)<.20&&Math.abs(angle(f.yaw,f.target.yaw))<.18;}
 function interact(s,selected=null){
  const n=clone(s);if(s.complete||s.failed||s.settling)return n;
  const a=getInteraction(s,typeof selected==="object"?selected:null);
  if(selected&&typeof selected==="object"&&!a){n.lastEvent="target_unavailable";return n;}
  n.interactions++;n.progress=Math.max(0,n.progress-LEVEL.progress.interactionCost);
  n.lastEvent="empty_interaction";if(!a)return depleted(n);
  const item=s.items[a.item??s.carriedItem];
  if(a.type==="tissue-catch"){
   if(s.catchPending!==a.item||item.location!=="catching"||!s.catchHand||distance3(s.catchHand,item)>.055){n.interactions=s.interactions;n.progress=s.progress;n.lastEvent="target_unavailable";return n;}
   n.carriedItem=a.item;n.items[a.item].location="carried";n.catchPending=null;reward(n,"pickup:"+a.item);n.lastEvent="tissue_caught";
  }else if(a.type==="pickup"){
   n.carriedItem=a.item;n.items[a.item].location="carried";n.motion="carrying";
   reward(n,"pickup:"+a.item);n.lastEvent="picked_up";
  }else if(a.type==="drop"){
   if(!isWalkable(s,a.point.x,a.point.z,.14)){n.lastEvent="blocked_drop";return depleted(n);}
   n.items[a.item]={...item,...a.point,location:"floor"};n.carriedItem=null;n.lastEvent="placed";
  }else if(a.type==="deliver"){
   const target=item.type==="tissue"?"bin":{towel:"laundry",cup:"cart",trash:"bin"}[a.item];
   if(target!==a.target)n.lastEvent="wrong_target";
   else{n.items[a.item].location=a.target;n.carriedItem=null;n.delivered[a.item]=true;reward(n,"deliver:"+a.item);n.lastEvent="delivered";}
  }else if(a.type==="restock"){
   const occupied=n.slots[a.slot],oldStillThere=a.slot==="towel1"&&!n.delivered.towel||a.slot.startsWith("cup")&&!n.delivered.cup;
   if(item.type!==SLOTS[a.slot].type||occupied||oldStillThere)n.lastEvent="slot_unavailable";
   else{n.items[a.item]={...item,location:"slot",slot:a.slot};n.slots[a.slot]=a.item;n.carriedItem=null;reward(n,"restock:"+a.slot);n.lastEvent="restocked";}
  }else if(a.type==="window-close"){
   if(n.wind.opening>0||n.wind.latch<1){n.interactions=s.interactions;n.progress=s.progress;n.lastEvent="animation_required";return n;}
   n.wind.latched=true;reward(n,"window-close");n.lastEvent="window_closed";
  }else if(a.type==="grip"){
   if(distance(s.player,standForFurniture(s.furniture[a.key]))>.16||Math.abs(angle(s.player.yaw,s.furniture[a.key].yaw))>.16){n.lastEvent="alignment_required";return depleted(n);}
   n.attachment=a.key;n.lastEvent="gripped";
  }else if(a.type==="release"){n.attachment=null;n.lastEvent=parked(s.furniture[a.key])?"parked":"released";if(parked(s.furniture[a.key]))reward(n,"park:"+a.key);}
  else if(a.type==="exit"){
   if(ready(s)){n.exitConfirmed=true;n.lastEvent="room_ready";}else n.lastEvent="room_incomplete";
  }
  if(ready(n)&&(id!=="rf05-3"||n.exitConfirmed)&&!n.attachment){n.complete=true;n.progress=100;n.lastEvent="room_ready";}
  n.motion=n.carriedItem?"carrying":"idle";return depleted(n);
 }
 function updateTaskAction(s,a,progress,from){const n=clone(s);animateWindow(n.wind,progress,from);return n;}
 return {updateTaskAction,LEVEL,createInitialState,cloneState:clone,isWalkable,furnitureClear,updateMovement,updateEnvironment,getInteraction,interact,parked,ready,closeTerminal:clone,getObjective:()=>({title:objectives[id],detail:""})};
}
