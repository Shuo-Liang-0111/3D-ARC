import {applyRobotMovement} from "../../movement.js";
import {IDS,OBJECTIVES,makeLevel,initialItems,SEATS,TARGET_SEAT_ID,CHAIRS,TYPES,STATIC,rect,distance,furniturePoint,chairStand,TASK_ITEMS,PHONE_SECONDS,PHONE_POINT,PHONE_START_DELAY_MIN,PHONE_START_DELAY_MAX} from "./office-layout.js";
export const circleRect=(x,z,r,b)=>Math.hypot(x-Math.max(b.minX,Math.min(x,b.maxX)),z-Math.max(b.minZ,Math.min(z,b.maxZ)))<r-1e-6;
export function createOfficeEngine(id){
 if(!IDS.includes(id))throw Error("Unknown office level");
 const LEVEL=makeLevel(id),needsChair=id!=="rf09",needsPhone=id==="rf09-3";
 const clone=s=>({...s,player:{...s.player},items:Object.fromEntries(Object.entries(s.items).map(([k,v])=>[k,{...v}])),chairs:Object.fromEntries(Object.entries(s.chairs).map(([k,v])=>[k,{...v,target:{...v.target}}])),seats:s.seats.map(x=>({...x})),phone:{...s.phone},rewarded:{...s.rewarded}});
 function createInitialState(options={}){const random=typeof options?.random==="function"?options.random:Math.random;return {
  level:id,player:{...LEVEL.playerStart},items:initialItems(),
  chairs:Object.fromEntries(Object.entries(CHAIRS).map(([k,v])=>[k,{...v,...(needsChair&&k==="chair-a"?{}:v.target),target:{...v.target}}])),
  carriedItem:null,attachment:null,seats:SEATS.map((seat,index)=>({id:seat.id,doc:index===0?null:"docs-"+(index+1),water:index===0?null:"water-"+(index+1)})),
  phone:{status:needsPhone?"pending":"inactive",ringAt:needsPhone?PHONE_START_DELAY_MIN+random()*(PHONE_START_DELAY_MAX-PHONE_START_DELAY_MIN):null,deadline:null,remaining:PHONE_SECONDS},
  progress:LEVEL.progress.initial,rewarded:{},complete:false,failed:false,failureReason:null,settling:false,terminalOpen:false,
  elapsed:0,clock:0,interactions:0,motion:"idle",lastEvent:"started"
 };}
 function collisionRects(s,exclude=null){return [...STATIC,...Object.values(s.chairs).filter(c=>c.id!==exclude).map(c=>rect(c.id,c.x,c.z,c.width,c.depth))];}
 function isWalkable(s,x,z,r=LEVEL.playerRadius,exclude=null){const b=LEVEL.bounds;return Number.isFinite(x)&&Number.isFinite(z)&&x-r>=b.minX&&x+r<=b.maxX&&z-r>=b.minZ&&z+r<=b.maxZ&&!collisionRects(s,exclude).some(b=>circleRect(x,z,r,b))&&(!s.carriedItem||STATIC.filter(q=>q.id.includes("wall")||q.id.includes("glass")||["supply-cabinet","it-locker","reception-desk","meeting-terminal"].includes(q.id)).every(b=>!circleRect(x,z,.56,b)));}
 function clearRay(s,a,b){
  const count=Math.ceil(distance(a,b)/.04),blocks=STATIC.filter(r=>!["conference-table","admin-counter","it-counter","reception-desk","printer-counter","meeting-terminal","returns-counter"].includes(r.id)&&!r.id.startsWith("cubicle")&&!r.id.includes("chair"));
  for(let i=1;i<count;i++){const t=i/count,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(blocks.some(r=>x>r.minX&&x<r.maxX&&z>r.minZ&&z<r.maxZ))return false;}return true;
 }
 function near(s,p){return distance(s.player,p)<=LEVEL.interactionRange&&clearRay(s,s.player,p);}
 function chairFits(s,c,exclude){
  const r=.30,b=LEVEL.bounds;
  if(c.x-r<b.minX||c.x+r>b.maxX||c.z-r<b.minZ||c.z+r>b.maxZ)return false;
  return collisionRects(s,exclude).filter(r=>r.id!=="conference-table"&&!r.id.includes("chair")).every(b=>!circleRect(c.x,c.z,r,b))&&c.z>=-3.66;
 }
 // Carry footprint follows the same hand-relative anchor as the animation.
 // Only surfaces at or above the carried object can block it.
 function payloadFits(s,x,z){
  if(!s.carriedItem)return true;
  const type=s.items[s.carriedItem].type,[w,,d]=TYPES[type].size,yaw=s.player.yaw;
  const side=type==="tray"?0:-.15,fx=x+Math.sin(yaw)*.32+Math.cos(yaw)*side,fz=z+Math.cos(yaw)*.32-Math.sin(yaw)*side;
  const rx=Math.abs(Math.cos(yaw))*w/2+Math.abs(Math.sin(yaw))*d/2,rz=Math.abs(Math.sin(yaw))*w/2+Math.abs(Math.cos(yaw))*d/2,b=LEVEL.bounds;
  if(fx-rx<b.minX||fx+rx>b.maxX||fz-rz<b.minZ||fz+rz>b.maxZ)return false;
  return STATIC.filter(q=>q.id.includes("wall")||q.id.includes("glass")||["supply-cabinet","it-locker","reception-desk","meeting-terminal"].includes(q.id)).every(q=>fx+rx<=q.minX||fx-rx>=q.maxX||fz+rz<=q.minZ||fz-rz>=q.maxZ);
 }

 function failIfDepleted(n){
  if(n.progress<=1e-6&&!n.complete){n.progress=0;n.failed=true;n.failureReason="progress_depleted";n.motion="idle";n.terminalOpen=false;n.lastEvent="progress_depleted";}
  return n;
 }
 function reward(n,key,amount){if(!n.rewarded[key]){n.rewarded[key]=true;n.progress=Math.min(LEVEL.progress.maximum,n.progress+amount);}}
 function chairParked(s){const c=s.chairs["chair-a"];return distance(c,c.target)<.14&&Math.abs(Math.atan2(Math.sin(c.yaw-c.target.yaw),Math.cos(c.yaw-c.target.yaw)))<.16;}
 const targetSeat=s=>s.seats.find(seat=>seat.id===TARGET_SEAT_ID)||s.seats[0];
 const readiness=s=>{const seat=targetSeat(s);return {documents:Boolean(seat?.doc),water:Boolean(seat?.water),chairs:chairParked(s),phone:s.phone.status==="answered"};};
 function finishIfReady(n){
  const q=readiness(n);
  if(q.documents&&q.water&&(!needsChair||q.chairs)&&(!needsPhone||q.phone)&&!n.attachment&&!n.carriedItem&&!n.failed){n.complete=true;n.progress=LEVEL.progress.maximum;n.lastEvent="setup_complete";}
  return n;
 }
 function updateMovement(s,input={},seconds=0){
  const n=clone(s),dt=Math.min(.05,Math.max(0,seconds));n.elapsed+=dt;
  if(s.complete||s.failed||s.settling)return n;
  const m=applyRobotMovement(n,s,input,dt,LEVEL,(st,x,z)=>isWalkable(st,x,z,LEVEL.playerRadius,s.attachment)&&payloadFits(st,x,z));
  if(s.attachment){
   const c=s.chairs[s.attachment],f={...c,x:n.player.x+Math.sin(n.player.yaw)*.82,z:n.player.z+Math.cos(n.player.yaw)*.82,yaw:n.player.yaw};
   if(!chairFits(s,f,c.id)||!isWalkable(s,n.player.x,n.player.z,LEVEL.playerRadius,c.id))n.player={...s.player};else n.chairs[c.id]=f;
  }
  // Match preceding levels: translation intent consumes reserve, including a blocked attempt.
  // Pure rotation, passive simulation drift and explicitly non-draining animation frames do not.
  if(m.translating&&input.drain!==false&&!input.passiveMotion)n.progress=Math.max(0,s.progress-LEVEL.progress.actionDrainPerSecond*dt);
  n.motion=m.motionTurning?"turning":m.translating?"moving":s.carriedItem?"carrying":s.attachment?"pushing":"idle";return failIfDepleted(n);
 }

 function candidates(s){
  if(s.complete||s.failed||s.settling)return [];
  if(s.attachment){const c=s.chairs[s.attachment];return [{type:"release",chair:c.id,point:furniturePoint(c)}];}
  const out=[];
  if(s.phone.status==="ringing"&&near(s,PHONE_POINT))out.push({type:"answer",target:"phone",point:PHONE_POINT});
  if(s.carriedItem){
   const item=s.items[s.carriedItem],kind=item.type==="documents"?"doc":"water";
   for(const seat of SEATS){
    const point=seat[kind];
    if(near(s,point))out.push({type:"seat",target:seat.id,point,item:item.id,kind,blocked:Boolean(s.seats.find(entry=>entry.id===seat.id)?.[kind])});
   }
   if(!out.length){const point={x:s.player.x+Math.sin(s.player.yaw)*.60,y:.012,z:s.player.z+Math.cos(s.player.yaw)*.60};out.push({type:"drop",item:item.id,point,blocked:!isWalkable(s,point.x,point.z,.18)});}
  }else{
   for(const key of TASK_ITEMS){const item=s.items[key];if(["surface","floor"].includes(item.location)&&near(s,item))out.push({type:"pickup",target:key,item:key,point:item});}
   const c=s.chairs["chair-a"],stand=chairStand(c);
   if(needsChair&&!chairParked(s)&&distance(s.player,stand)<1.35&&clearRay(s,s.player,stand))out.push({type:"grip",chair:c.id,point:furniturePoint(c),stand});
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
  if(a.blocked){n.lastEvent=a.type==="seat"?"seat_occupied":"path_blocked";return failIfDepleted(n);}
  n.lastEvent=a.type;
  if(a.type==="pickup"){
   n.carriedItem=a.item;n.items[a.item].location="carried";n.motion="carrying";
   for(const seat of n.seats)for(const key of ["doc","water"])if(seat[key]===a.item)seat[key]=null;
   reward(n,"pickup:"+a.item,LEVEL.progress.pickupReward);
  }else if(a.type==="seat"||a.type==="drop"){
   Object.assign(n.items[a.item],a.point,{yaw:s.player.yaw,location:a.type==="seat"?"surface":"floor"});n.carriedItem=null;n.motion="idle";
   if(a.type==="seat"){
    const seat=n.seats.find(entry=>entry.id===a.target)||targetSeat(n);
    seat[a.kind]=a.item;reward(n,"seat:"+seat.id+":"+a.kind,LEVEL.progress.placementReward);
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
  if(needsPhone&&n.phone.status==="pending"&&n.clock>=n.phone.ringAt){
   n.phone.status="ringing";n.phone.deadline=n.clock+PHONE_SECONDS;n.phone.remaining=PHONE_SECONDS;n.lastEvent="phone_ringing";
  }
  return expirePhone(n);
 }
 return {LEVEL,createInitialState,cloneState:clone,isWalkable,payloadFits,collisionRects,clearRay,updateMovement,getInteraction,interact,updateEnvironment,readiness,chairsReady:chairParked,chairParked,closeTerminal:s=>({...s,terminalOpen:false}),getObjective:s=>({title:OBJECTIVES[id],detail:s.failed?(s.failureReason==="phone_timeout"?"未在 30 秒内接听电话":"状态余量耗尽"):s.complete?"任务完成":"靠近后按 F，扶椅后使用移动键推行"})};
}
