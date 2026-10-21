import {isWalkable,updateMovement as baseMove} from "../rf06/series-collision.js";
import {LEVEL as BASE,HOME} from "../rf06/home-layout.js";
import {createInitialState as baseInitial} from "../rf06/engine.js";
import {G1_MUJOCO_VELOCITY_LIMITS} from "../../mujoco-client.js";
export {isWalkable};
export const REVISION="rf06-pest-v2";
export const CAN=HOME.can;
export const RULES=Object.freeze({count:2,speed:G1_MUJOCO_VELOCITY_LIMITS.forward*2,decisionSeconds:.35,forwardProbability:.8,bodyLength:.06,radius:.037,burstSeconds:.18,cooldownSeconds:.4,sprayRange:2.1,sprayHalfAngle:Math.PI/9});
export const LEVEL=Object.freeze({...BASE,id:"rf06-3",title:"住宅蟑螂清理",interactionRange:1.15});
export const OBJECTIVE="拿起杀虫剂，消灭住宅内的两只蟑螂。";
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function rng(s){let x=s.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;s.rng=x>>>0;return s.rng/4294967296;}
export function chooseDirection(r){const front=rng(r)<RULES.forwardProbability;const angle=(rng(r)-.5)*Math.PI+(front?0:Math.PI);r.yaw=Math.atan2(Math.sin(r.yaw+angle),Math.cos(r.yaw+angle));r.decisions++;r.forwardDecisions+=Number(front);return {front,angle};}
export function roachWalkable(x,z){
 const radius=RULES.radius,b=BASE.bounds;if(x-radius<b.minX||x+radius>b.maxX||z-radius<b.minZ||z+radius>b.maxZ)return false;
 return !BASE.staticColliders.some(r=>(x-Math.max(r.minX,Math.min(x,r.maxX)))**2+(z-Math.max(r.minZ,Math.min(z,r.maxZ)))**2<radius**2);
}
function stepRoach(r,dt){
 let remaining=dt;
 while(remaining>1e-8){
  if(r.untilDecision<=1e-8){chooseDirection(r);r.untilDecision=RULES.decisionSeconds;}
  const step=Math.min(remaining,r.untilDecision,.008),d=RULES.speed*step,dx=Math.sin(r.yaw)*d,dz=Math.cos(r.yaw)*d;
  if(roachWalkable(r.x+dx,r.z+dz)){r.x+=dx;r.z+=dz;r.travel+=d;}
  else {
   const xClear=roachWalkable(r.x+dx,r.z),zClear=roachWalkable(r.x,r.z+dz);
   if(!xClear)r.yaw=-r.yaw;
   if(!zClear)r.yaw=Math.PI-r.yaw;
   if(xClear&&zClear)r.yaw+=Math.PI/2;
   r.collisions++;
   // Collision reflection is independent of the 80/20 random decision.
  }
  r.untilDecision-=step;remaining-=step;r.elapsed+=step;
 }
}
export function createInitialState(seed=(Math.random()*0xffffffff)>>>0){
 const s=baseInitial();s.items=Object.fromEntries(Object.entries(BASE.items).map(([type,p])=>[type,{type,location:"room",...p}]));return {...s,revision:REVISION,mode:1,water:0,puddleClean:true,valveClosed:true,canLocation:"shelf",carriedItem:null,
  roaches:[{id:"roach-1",x:-2.4,z:1.7,yaw:1,rng:(seed^0x9e3779b9)>>>0||1},{id:"roach-2",x:1.95,z:.1,yaw:-1,rng:(seed^0x85ebca6b)>>>0||2}].map(r=>({...r,alive:true,untilDecision:RULES.decisionSeconds,decisions:0,forwardDecisions:0,travel:0,collisions:0,elapsed:0})),
  burst:null,cooldown:0,shots:0,kills:0,pendingComplete:false,complete:false,failed:false,lastEvent:"pest_started"};
}
export function updateMovement(s,input,dt){return baseMove(s,input,dt);}
export function updateEnvironment(state,delta){
 if(state.complete||state.failed)return state;
 const dt=Math.min(.1,Math.max(0,delta)),s={...state,roaches:state.roaches.map(r=>({...r})),cooldown:Math.max(0,state.cooldown-dt)};
 if(s.burst){s.burst={...s.burst,remaining:Math.max(0,s.burst.remaining-dt)};if(s.burst.remaining<=0)s.burst=null;}
 for(const r of s.roaches)if(r.alive)stepRoach(r,dt);
 if(s.pendingComplete&&!s.burst){s.complete=true;s.progress=100;s.lastEvent="pests_cleared";}
 return s;
}
export function getInteraction(s){
 if(s.complete||s.failed||s.pendingComplete)return null;
 if(s.carriedItem==="spray")return {type:"spray",label:"短喷杀虫剂",point:{x:s.player.x,y:.9,z:s.player.z}};
 if(s.canLocation==="shelf"&&dist(s.player,CAN)<=LEVEL.interactionRange)return {type:"pickup",item:"spray",label:"拿起杀虫剂",point:{...CAN,y:CAN.y+.11}};
 return null;
}
function segmentRect(a,b,r){
 let lo=0,hi=1;
 for(const axis of ["x","z"]){
  const min=r[axis==="x"?"minX":"minZ"],max=r[axis==="x"?"maxX":"maxZ"],d=b[axis]-a[axis];
  if(Math.abs(d)<1e-10){if(a[axis]<min||a[axis]>max)return false;continue;}
  const t0=(min-a[axis])/d,t1=(max-a[axis])/d;lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));
  if(lo>hi)return false;
 }
 return hi>=0&&lo<=1;
}
export function sprayHits(origin,direction,roach){
 if(!roach.alive)return false;
 const delta={x:roach.x-origin.x,y:.045-origin.y,z:roach.z-origin.z},length=Math.hypot(delta.x,delta.y,delta.z);
 if(length>RULES.sprayRange||length<.01)return false;
 const dot=(delta.x*direction.x+delta.y*direction.y+delta.z*direction.z)/length;
 if(dot<Math.cos(RULES.sprayHalfAngle))return false;
 return !BASE.staticColliders.some(r=>segmentRect(origin,roach,r));
}
export function defaultNozzle(s){const yaw=s.player.yaw;return {origin:{x:s.player.x+Math.sin(yaw)*.43-Math.cos(yaw)*.16,y:1.0,z:s.player.z+Math.cos(yaw)*.43+Math.sin(yaw)*.16},direction:{x:Math.sin(yaw)*Math.cos(.65),y:-Math.sin(.65),z:Math.cos(yaw)*Math.cos(.65)}};}
export function interact(state,a=getInteraction(state)){
 if(!a||state.complete||state.failed||state.pendingComplete)return state;
 if(a.type==="pickup"){
  if(state.carriedItem||state.canLocation!=="shelf"||dist(state.player,CAN)>LEVEL.interactionRange)return state;
  return {...state,canLocation:"held",carriedItem:"spray",interactions:state.interactions+1,progress:Math.min(100,state.progress+10),lastEvent:"spray_taken"};
 }
 if(a.type!=="spray"||state.carriedItem!=="spray"||state.cooldown>0)return state;
 const nozzle=a.origin&&a.direction?a:defaultNozzle(state),roaches=state.roaches.map(r=>({...r}));
 let hit=0;for(const r of roaches)if(sprayHits(nozzle.origin,nozzle.direction,r)){r.alive=false;hit++;}
 const kills=state.kills+hit;
 return {...state,roaches,kills,shots:state.shots+1,interactions:state.interactions+1,cooldown:RULES.cooldownSeconds,
  burst:{origin:{...nozzle.origin},direction:{...nozzle.direction},remaining:RULES.burstSeconds},pendingComplete:kills===RULES.count,
  progress:Math.min(100,state.progress+hit*15),lastEvent:hit?"roach_killed":"spray_missed"};
}
export const closeTerminal=s=>({...s});
export const getObjective=s=>({step:0,title:s.complete?"蟑螂已清理":s.failed?"任务失败":"住宅蟑螂清理",detail:OBJECTIVE});
