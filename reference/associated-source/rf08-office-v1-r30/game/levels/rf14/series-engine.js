import { applyRobotMovement } from "../../movement.js";
import { SERIES_BALLS, BINS, TYPES, COLLIDERS, WEATHER, seriesLevel, sheltered, binPose } from "./series-layout.js";
const EPS=1e-8;
export const cloneState=s=>({...s,player:{...s.player},items:Object.fromEntries(Object.entries(s.items).map(([k,v])=>[k,{...v}])),delivered:[...s.delivered],weather:{...s.weather}});
function sample(w,min,max){w.seed=(Math.imul(w.seed,1664525)+1013904223)>>>0;return min+(max-min)*w.seed/4294967296;}
export function overlap(x,z,r,b){return (x-Math.max(b.minX,Math.min(x,b.maxX)))**2+(z-Math.max(b.minZ,Math.min(z,b.maxZ)))**2<r*r;}
export function createCourtEngine(id){
 const LEVEL=seriesLevel(id),sorting=id!=="rf14",rainEnabled=id==="rf14-3";
 function createInitialState(options={}){
  const weather={enabled:rainEnabled,seed:(options.seed??Math.floor(Math.random()*4294967296))>>>0,raining:false,storm:0,exposure:0,sheltered:false,remaining:0};
  weather.remaining=sample(weather,WEATHER.dryMin,WEATHER.dryMax);
  return {player:{...LEVEL.playerStart},items:Object.fromEntries(SERIES_BALLS.map(b=>[b.id,{...b,location:"floor",bin:null}])),carriedItem:null,delivered:[],complete:false,failed:false,terminalOpen:false,progress:100,motion:"idle",elapsed:0,interactions:0,lastEvent:"court_started",weather};
 }
 function isWalkable(s,x,z){
  const r=LEVEL.playerRadius,f=LEVEL.playerForwardOffset,b=LEVEL.bounds;
  return [{x,z},{x:x+Math.sin(s.player.yaw)*f,z:z+Math.cos(s.player.yaw)*f}].every(p=>p.x-r>=b.minX&&p.x+r<=b.maxX&&p.z-r>=b.minZ&&p.z+r<=b.maxZ&&!COLLIDERS.some(c=>overlap(p.x,p.z,r,c)));
 }
 function canReach(s,p,ignore=[]){
  const dx=p.x-s.player.x,dz=p.z-s.player.z,d=Math.hypot(dx,dz);
  if(d>LEVEL.interactionRange||d>.1&&(Math.sin(s.player.yaw)*dx+Math.cos(s.player.yaw)*dz)/d<.2)return false;
  return !COLLIDERS.filter(c=>!ignore.includes(c.id)).some(c=>{
   for(let i=1;i<32;i++){const x=s.player.x+dx*i/32,z=s.player.z+dz*i/32;if(x>c.minX&&x<c.maxX&&z>c.minZ&&z<c.maxZ)return true;}return false;
  });
 }
 function nearbyBin(s){return BINS.filter(b=>canReach(s,b,["cart","orange-cart"])).sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];}
 function getInteraction(s){
  if(s.complete||s.failed||s.settling)return null;
  const bin=nearbyBin(s);
  if(s.carriedItem)return bin?{type:"deliver",item:s.carriedItem,bin:bin.id,label:"放入"+TYPES[bin.id].label+"筐"}:{type:"drop",item:s.carriedItem,label:"放下网球"};
  // Wrongly classified balls remain recoverable. Correct balls do not block correction.
  const wrong=bin&&Object.values(s.items).find(b=>b.location==="bin"&&b.bin===bin.id&&sorting&&b.type!==bin.id);
  if(wrong)return {type:"pickup",item:wrong.id,label:"取回放错的"+TYPES[wrong.type].name};
  const nearest=Object.values(s.items).filter(b=>b.location==="floor"&&canReach(s,b)).sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];
  return nearest?{type:"pickup",item:nearest.id,label:"捡起"+nearest.name}:null;
 }
 function dropPose(s){
  const p={x:s.player.x+Math.sin(s.player.yaw)*.53,z:s.player.z+Math.cos(s.player.yaw)*.53,y:.004};
  if(!canReach(s,p)||COLLIDERS.some(c=>overlap(p.x,p.z,.04,c))||p.x<LEVEL.bounds.minX+.05||p.x>LEVEL.bounds.maxX-.05||p.z<LEVEL.bounds.minZ+.05||p.z>LEVEL.bounds.maxZ-.05)return null;
  return p;
 }
 function spendReserve(s,amount){
  const n=cloneState(s);if(s.complete||s.failed||s.settling)return n;
  n.progress=Math.max(0,n.progress-amount);
  if(n.progress===0){n.failed=true;n.failureReason="reserve_depleted";n.lastEvent="progress_depleted";}
  return n;
 }
 function chargeInteraction(s){return spendReserve(s,LEVEL.progress.interactionDrain);}
 function interact(s,selected=null,{charge=true}={}){
  const n=charge?chargeInteraction(s):cloneState(s);if(n.complete||n.failed||n.settling)return n;
  const a=selected??getInteraction(s);if(!a){n.lastEvent="empty_interaction";return n;}
  const ball=n.items[a.item??s.carriedItem];if(!ball)return n;
  if(a.type==="pickup"){
   if(s.carriedItem||!["floor","bin"].includes(ball.location)||!canReach(s,ball,ball.location==="bin"?["cart","orange-cart"]:[]))return n;
   ball.location="carried";ball.bin=null;n.carriedItem=ball.id;n.lastEvent="ball_picked";
  }else if(a.type==="deliver"){
   const bin=BINS.find(b=>b.id===a.bin);if(s.carriedItem!==ball.id||!bin||!canReach(s,bin,["cart","orange-cart"]))return n;
   const occupied=new Set(Object.values(s.items).filter(b=>b.location==="bin"&&b.bin===bin.id).map(b=>b.slot));
   let slot=0;while(occupied.has(slot))slot++;
   Object.assign(ball,binPose(bin.id,slot),{location:"bin",bin:bin.id,slot});n.carriedItem=null;n.lastEvent=!sorting||ball.type===bin.id?"ball_sorted":"wrong_bin";
  }else if(a.type==="drop"){
   const p=a.releasePoint??dropPose(s);if(s.carriedItem!==ball.id||!p||!canReach(s,p)||COLLIDERS.some(c=>overlap(p.x,p.z,.04,c))){n.lastEvent="drop_blocked";return n;}
   Object.assign(ball,p,{location:"floor",bin:null});n.carriedItem=null;n.lastEvent="ball_dropped";
  }else return n;
  n.interactions++;
  if(n.lastEvent==="ball_sorted"&&!ball.returnRewarded){n.progress=Math.min(LEVEL.progress.maximum,n.progress+LEVEL.progress.correctReturnReward);ball.returnRewarded=true;}
  n.delivered=Object.values(n.items).filter(b=>b.location==="bin"&&(!sorting||b.bin===b.type)).map(b=>b.id);
  n.complete=n.delivered.length===SERIES_BALLS.length;n.motion=n.carriedItem?"carrying":"idle";
  if(n.complete)n.lastEvent="court_complete";
  return n;
 }
 function updateMovement(s,input={},dt=0){
  let n=cloneState(s);if(s.complete||s.failed)return n;
  const d=Math.min(.05,Math.max(0,Number.isFinite(dt)?dt:0));
  const m=applyRobotMovement(n,s,input,d,LEVEL,isWalkable);
  const distance=Math.hypot(n.player.x-s.player.x,n.player.z-s.player.z);
  if(!input.passiveMotion&&distance>0)n=spendReserve(n,distance*LEVEL.progress.drainPerMeter);
  n.motion=m.motionTurning?"turning":m.translating?"moving":s.carriedItem?"carrying":"idle";return n;
 }
 function updateEnvironment(s,seconds=0){
  const n=cloneState(s);if(s.complete||s.failed)return n;
  let dt=Math.max(0,Number.isFinite(seconds)?seconds:0);n.elapsed+=dt;
  const w=n.weather;w.sheltered=sheltered(n.player,LEVEL);if(!w.enabled)return n;
  // Split at transitions so large frame gaps cannot lose rain or exposure time.
  while(dt>EPS&&!n.failed){
   const step=Math.min(dt,w.remaining);
   if(w.raining&&!w.sheltered){
    w.exposure+=step;
    if(w.exposure-WEATHER.exposureLimit>EPS){n.failed=true;n.failureReason="rain_exposure";n.lastEvent="rain_failed";}
   }
   w.remaining=Math.max(0,w.remaining-step);dt-=step;
   if(w.remaining<=EPS&&!n.failed){
    w.raining=!w.raining;
    if(w.raining){w.storm++;w.exposure=0;w.remaining=sample(w,WEATHER.rainMin,WEATHER.rainMax);n.lastEvent="rain_started";}
    else {w.remaining=sample(w,WEATHER.dryMin,WEATHER.dryMax);n.lastEvent="rain_stopped";}
   }
  }
  return n;
 }
 function getObjective(s){return {step:s.complete?3:1,title:s.failed?(s.failureReason==="rain_exposure"?"本场累计淋雨超过30秒":"任务余量耗尽"):s.complete?"球场整理完成":rainEnabled?"将两类网球分类归筐，并在下雨时进棚避雨":sorting?"将黄色标准球与橙色训练球分别归筐":"收集8颗网球并全部归筐",detail:s.failed?"按 R 重新开始":rainEnabled?"每场雨累计淋雨超过30秒失败，进棚暂停累计，下一场雨清零。":"放错的球可从筐中取回纠正。"};}
 return {LEVEL,sorting,rainEnabled,createInitialState,isWalkable,canReach,getInteraction,interact,chargeInteraction,updateMovement,updateEnvironment,dropPose,getObjective,closeTerminal:cloneState};
}
