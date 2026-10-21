from pathlib import Path
p=Path('game/levels/rf09/office-engine.js');old=p.read_text()
collision=old[old.index(' function collisionRects'):old.index(' function failIfDepleted')].replace('c.z>=-3.52','c.z>=-3.66')
movement=old[old.index(' function updateMovement'):old.index(' const targetAction=')]
s='''import {applyRobotMovement} from "../../movement.js";
import {IDS,OBJECTIVES,makeLevel,initialItems,SEATS,CHAIRS,TYPES,STATIC,rect,distance,furniturePoint,chairStand,TASK_ITEMS,PHONE_SECONDS,PHONE_POINT} from "./office-layout.js";
export const circleRect=(x,z,r,b)=>Math.hypot(x-Math.max(b.minX,Math.min(x,b.maxX)),z-Math.max(b.minZ,Math.min(z,b.maxZ)))<r-1e-6;
export function createOfficeEngine(id){
 if(!IDS.includes(id))throw Error("Unknown office level");
 const LEVEL=makeLevel(id),needsChair=id!=="rf09",needsPhone=id==="rf09-3";
 const clone=s=>({...s,player:{...s.player},items:Object.fromEntries(Object.entries(s.items).map(([k,v])=>[k,{...v}])),chairs:Object.fromEntries(Object.entries(s.chairs).map(([k,v])=>[k,{...v,target:{...v.target}}])),seats:s.seats.map(x=>({...x})),phone:{...s.phone},rewarded:{...s.rewarded}});
 function createInitialState(){return {
  level:id,player:{...LEVEL.playerStart},items:initialItems(),
  chairs:Object.fromEntries(Object.entries(CHAIRS).map(([k,v])=>[k,{...v,...(needsChair&&k==="chair-a"?{}:v.target),target:{...v.target}}])),
  carriedItem:null,attachment:null,seats:[{id:"1",doc:null,water:null}],
  phone:{status:needsPhone?"pending":"inactive",deadline:null,remaining:PHONE_SECONDS},
  progress:LEVEL.progress.initial,rewarded:{},complete:false,failed:false,failureReason:null,settling:false,terminalOpen:false,
  elapsed:0,clock:0,interactions:0,motion:"idle",lastEvent:"started"
 };}
'''+collision+'''
 function failIfDepleted(n){
  if(n.progress<=1e-6&&!n.complete){n.progress=0;n.failed=true;n.failureReason="progress_depleted";n.motion="idle";n.terminalOpen=false;n.lastEvent="progress_depleted";}
  return n;
 }
 function reward(n,key,amount){if(!n.rewarded[key]){n.rewarded[key]=true;n.progress=Math.min(LEVEL.progress.maximum,n.progress+amount);}}
 function chairParked(s){const c=s.chairs["chair-a"];return distance(c,c.target)<.14&&Math.abs(Math.atan2(Math.sin(c.yaw-c.target.yaw),Math.cos(c.yaw-c.target.yaw)))<.16;}
 const readiness=s=>({documents:Boolean(s.seats[0].doc),water:Boolean(s.seats[0].water),chairs:chairParked(s),phone:s.phone.status==="answered"});
 function finishIfReady(n){
  const q=readiness(n);
  if(q.documents&&q.water&&(!needsChair||q.chairs)&&(!needsPhone||q.phone)&&!n.attachment&&!n.carriedItem&&!n.failed){n.complete=true;n.progress=LEVEL.progress.maximum;n.lastEvent="setup_complete";}
  return n;
 }
'''+movement+'''
 function candidates(s){
  if(s.complete||s.failed||s.settling)return [];
  if(s.attachment){const c=s.chairs[s.attachment];return [{type:"release",chair:c.id,point:furniturePoint(c)}];}
  const out=[];
  if(s.phone.status==="ringing"&&near(s,PHONE_POINT))out.push({type:"answer",target:"phone",point:PHONE_POINT});
  if(s.carriedItem){
   const item=s.items[s.carriedItem],kind=item.type==="documents"?"doc":"water",point=SEATS[0][kind];
   if(near(s,point))out.push({type:"seat",target:"1",point,item:item.id,kind,blocked:Boolean(s.seats[0][kind])||(needsChair&&!chairParked(s))});
   if(!out.length){const point={x:s.player.x+Math.sin(s.player.yaw)*.60,y:.012,z:s.player.z+Math.cos(s.player.yaw)*.60};out.push({type:"drop",item:item.id,point,blocked:!isWalkable(s,point.x,point.z,.18)});}
  }else{
   for(const key of TASK_ITEMS){const item=s.items[key];if(["surface","floor"].includes(item.location)&&near(s,item))out.push({type:"pickup",target:key,item:key,point:item});}
   const c=s.chairs["chair-a"],stand=chairStand(c);
   if(needsChair&&distance(s.player,stand)<1.35&&clearRay(s,s.player,stand))out.push({type:"grip",chair:c.id,point:furniturePoint(c),stand});
  }
  return out;
 }
 function getInteraction(s,selected=null){
  const list=candidates(s);
  if(selected)return list.find(a=>a.type===selected.type&&a.item===selected.item&&a.target===selected.target&&a.chair===selected.chair&&a.kind===selected.kind)??null;
  const score=a=>{const dx=a.point.x-s.player.x,dz=a.point.z-s.player.z,d=Math.hypot(dx,dz),f=d?(dx*Math.sin(s.player.yaw)+dz*Math.cos(s.player.yaw))/d:1;return d+(1-f)*.22+(a.blocked?.12:0);};
  const a=list.sort((a,b)=>score(a)-score(b))[0]??null;
  if(a)a.label=({pickup:"拿起",seat:"摆放",grip:"扶住挡路椅子",release:"松开椅子",drop:"放下",answer:"接听电话（免提）"})[a.type]+(a.item?" "+TYPES[s.items[a.item].type].name:"");
  return a;
 }
 function expirePhone(n){
  if(n.phone.status!=="ringing")return n;
  n.phone.remaining=Math.max(0,n.phone.deadline-n.clock);
  if(n.phone.remaining<=1e-6){n.phone.remaining=0;n.phone.status="missed";n.failed=true;n.complete=false;n.failureReason="phone_timeout";n.motion="idle";n.lastEvent="phone_timeout";}
  return n;
 }
 function interact(s,selected=null){
  const n=expirePhone(clone(s));
  if(n.complete||n.failed||n.settling)return n;
  const a=getInteraction(n,selected);n.interactions++;n.progress=Math.max(0,n.progress-LEVEL.progress.interactionCost);
  if(!a){n.lastEvent="no_target";return failIfDepleted(n);}
  if(a.blocked){n.lastEvent=needsChair&&!chairParked(n)?"chair_not_parked":a.type==="seat"?"seat_occupied":"path_blocked";return failIfDepleted(n);}
  n.lastEvent=a.type;
  if(a.type==="pickup"){
   n.carriedItem=a.item;n.items[a.item].location="carried";n.motion="carrying";
   for(const key of ["doc","water"])if(n.seats[0][key]===a.item)n.seats[0][key]=null;
   reward(n,"pickup:"+a.item,LEVEL.progress.pickupReward);
  }else if(a.type==="seat"||a.type==="drop"){
   Object.assign(n.items[a.item],a.point,{yaw:s.player.yaw,location:a.type==="seat"?"surface":"floor"});n.carriedItem=null;n.motion="idle";
   if(a.type==="seat"){
    n.seats[0][a.kind]=a.item;reward(n,"seat:"+a.kind,LEVEL.progress.placementReward);
    if(needsPhone&&n.phone.status==="pending"){n.phone={status:"ringing",deadline:n.clock+PHONE_SECONDS,remaining:PHONE_SECONDS};n.lastEvent="phone_ringing";}
   }
  }else if(a.type==="grip"){n.attachment=a.chair;n.motion="pushing";}
  else if(a.type==="release"){
   n.attachment=null;n.motion="idle";
   if(chairParked(n)){reward(n,"chair:chair-a",LEVEL.progress.placementReward);n.lastEvent="chair_parked";}
  }else if(a.type==="answer"){
   n.phone.status="answered";n.phone.remaining=Math.max(0,n.phone.deadline-n.clock);n.phone.answeredAt=n.clock;n.lastEvent="phone_answered";
  }
  return failIfDepleted(finishIfReady(n));
 }
 function updateEnvironment(s,seconds){
  if(s.complete||s.failed)return s;
  const n=clone(s);n.clock+=Number.isFinite(seconds)?Math.max(0,seconds):0;
  return expirePhone(n);
 }
 return {LEVEL,createInitialState,cloneState:clone,isWalkable,payloadFits,collisionRects,clearRay,updateMovement,getInteraction,interact,updateEnvironment,readiness,chairsReady:chairParked,chairParked,closeTerminal:s=>({...s,terminalOpen:false}),getObjective:s=>({title:OBJECTIVES[id],detail:s.failed?(s.failureReason==="phone_timeout"?"未在 30 秒内接听电话":"状态余量耗尽"):s.complete?"任务完成":"靠近后按 F，扶椅后使用移动键推行"})};
}
'''
p.write_text(s)
