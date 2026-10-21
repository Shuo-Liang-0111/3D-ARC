import {MOUNTS} from './fixture-layout.js';
import {LEVEL as BASE,SAMPLE_META,SAMPLE_TYPES} from './level.js';
import {applyRobotMovement} from '../../movement.js';
export const REVISION='rf07-realism-v2';
export const OBJECTIVES={rf07:'按 A-17 → C-04 → B-12 装箱，安装冷却模块并启动温控，拿起运输箱即可完成任务。','rf07-2':'检查并启动全部三台冷藏柜。','rf07-3':'完成装样品、冷却与温控准备，处置一次设备泄漏后拿起运输箱。'};
export const CASE={x:1.2,y:.921,z:1.60},MODULE={x:3.65,y:.921,z:1.70};
export const CONTAINER={x:-6.65,y:1.068,z:-2.22},SINK={x:-9.82,y:.96,z:4.1};
export const DEVICES=[-2,0,2].map((x,i)=>({id:'bsc-0'+(i+1),x:x+MOUNTS.bsc.power.point[0],y:MOUNTS.bsc.power.point[1],z:-7.12+MOUNTS.bsc.power.point[2]}));
export const gripHeight={sampleA:.09,sampleB:.09,sampleC:.09,'cooling-module':.025,'transport-case':.205,'leak-container':.18};
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clone=s=>structuredClone(s);
const front=s=>({x:s.player.x+Math.sin(s.player.yaw)*.57,y:0,z:s.player.z+Math.cos(s.player.yaw)*.57});
export function createSeriesEngine(id){
 const LEVEL={...BASE,id,interactionRange:1.35};
 function createInitialState(random=Math.random){
  const off=Math.floor(random()*3),off2=random()<.5?(off+1)%3:off;
  return {player:{...BASE.playerStart},samples:Object.fromEntries(SAMPLE_TYPES.map(k=>[k,{location:'storage',x:BASE.samples[k].assetX,y:.9553,z:-6.77}])),caseSamples:[],casePoint:{...CASE},modulePoint:{...MODULE},containerPoint:{...CONTAINER},containerLocation:'storage',carriedItem:null,coolingModuleLocation:'prep-room',casePhase:'loading',cabinetPower:Object.fromEntries(Object.keys(BASE.coldCabinets).map((k,i)=>[k,id==='rf07-2'?i!==off&&i!==off2:true])),alarm:{type:'device',device:DEVICES[Math.floor(random()*DEVICES.length)].id,triggerAt:1+random()*179,status:id==='rf07-3'?'pending':'disabled',startedAt:null},clock:0,clockStamp:null,elapsed:0,complete:false,failed:false,settling:false,progress:100,motion:'idle',interactions:0,lastEvent:'started',rewards:[],delivered:false};
 }
 function isWalkable(s,x,z){
  let r=BASE.playerRadius+(s.carriedItem==='transport-case'?.10:0),b=BASE.bounds;
  if(s.doorOpen){const a={x:10.415,z:-.345},v={x:-.665,z:-.145},t=Math.max(0,Math.min(1,((x-a.x)*v.x+(z-a.z)*v.z)/(v.x*v.x+v.z*v.z)));if(Math.hypot(x-a.x-t*v.x,z-a.z-t*v.z)<r+.025)return false;}
  if(x-r<b.minX||x+r>b.maxX||z-r<b.minZ||z+r>b.maxZ)return false;
  const rects=[...BASE.staticColliders.filter(r=>r.id!=='bsc-bank').map(r=>r.id==='sample-receiving-bench'?{...r,minX:-11.30,maxX:-3.40,minZ:-7.60,maxZ:-6.60}:r),...[-2,0,2].map(x=>({id:'bsc-body',minX:x-.75,maxX:x+.75,minZ:-7.51,maxZ:-6.73})),{id:'sink-tray',minX:-10.35,maxX:-9.65,minZ:3.70,maxZ:4.50}];
  for(const rect of rects){let nx=Math.max(rect.minX,Math.min(x,rect.maxX)),nz=Math.max(rect.minZ,Math.min(z,rect.maxZ));if((x-nx)**2+(z-nz)**2<r*r)return false;}
  const floorItems=[...Object.values(s.samples).filter(p=>p.location==='floor'),...(s.coolingModuleLocation==='floor'?[s.modulePoint]:[]),...(s.casePhase==='floor'?[s.casePoint]:[]),...(s.containerLocation==='floor'?[s.containerPoint]:[])];
  return !floorItems.some(p=>distance(p,{x,z})<r+(p===s.casePoint?.32:.10));
 }
 function updateMovement(s,input,delta){
  const n=clone(s),dt=Math.min(.05,Math.max(0,delta));n.elapsed+=dt;if(n.complete||n.failed||n.settling)return n;
  const movement=applyRobotMovement(n,s,input,dt,LEVEL,isWalkable);n.motion=movement.active?(movement.motionTurning?'turning':s.carriedItem?'carrying':'moving'):s.carriedItem?'carrying':'idle';
  if(movement.active&&input.drain!==false&&id!=='rf07-2')n.progress=Math.max(0,n.progress-BASE.progress.actionDrainPerSecond*dt);
  if(n.progress<=0){n.failed=true;n.lastEvent='progress_depleted';}return n;
 }
 function advanceClock(s,seconds){
  const n=clone(s);if(n.complete||n.failed)return n;n.clock+=Math.max(0,seconds);
  if(n.alarm.status==='pending'&&n.clock>=n.alarm.triggerAt){n.alarm.status='active';n.alarm.startedAt=n.alarm.triggerAt;n.lastEvent='leak_alarm';}
  if(n.alarm.status==='active'&&n.clock-n.alarm.startedAt>=120){n.failed=true;n.complete=false;n.lastEvent='alarm_timeout';n.motion='idle';}return n;
 }
 function updateEnvironment(s,delta){return advanceClock(s,delta);}
 function pointFor(s,a){
  if(a.type==='cabinet-power'||a.type==='cabinet'){const c=BASE.coldCabinets[a.cabinet];return a.type==='cabinet'?{x:10.31,y:.960,z:c.assetZ}:{x:c.assetX-MOUNTS.cabinet.power.point[2],y:MOUNTS.cabinet.power.point[1],z:c.assetZ+MOUNTS.cabinet.power.point[0]};}
  if(a.type==='device-off')return DEVICES.find(d=>d.id===s.alarm.device);
  if(a.type==='drop')return {...front(s),y:gripHeight[s.carriedItem]};
  if(a.type==='sample')return {...s.samples[a.item],y:s.samples[a.item].y+gripHeight[a.item]};
  if(a.type==='cooling-module')return {...s.modulePoint,y:s.modulePoint.y+gripHeight['cooling-module']};
  if(a.type==='case-load'||a.type==='case-unload'){const item=a.item??s.caseSamples.at(-1),dx={sampleA:-.18,sampleC:0,sampleB:.18}[item]??0;return {x:s.casePoint.x+dx,y:s.casePoint.y+.044+.09,z:s.casePoint.z-.025};}
  if(a.type==='install-cooling')return {x:s.casePoint.x,y:s.casePoint.y+.044+.025,z:s.casePoint.z+.135};
  if(a.type==='case-seal'||a.type==='case-activate')return {x:s.casePoint.x+.20,y:s.casePoint.y+.27,z:s.casePoint.z+.225};
  return {...s.casePoint,z:s.casePoint.z+(a.type==='case-pickup'?MOUNTS.case.workContact[2]:.12),y:s.casePoint.y+(a.type==='case-pickup'?.205:a.type==='case-load'||a.type==='case-unload'?.134:a.type==='install-cooling'?.28:.34)};
 }
 const near=(s,p)=>distance(s.player,p)<=LEVEL.interactionRange;
 const decorate=(s,a)=>({...a,point:pointFor(s,a)});
 function getInteraction(s){
  if(s.complete||s.failed||s.settling)return null;
  const active=s.alarm.status==='active';
  if(s.carriedItem){
   if(active)return decorate(s,{type:'drop',label:'原地放下手持物，处理报警'});
   if(s.carriedItem==='transport-case'){
    const c=Object.entries(BASE.coldCabinets).filter(([k,p])=>near(s,{x:10.31,z:p.assetZ})).sort((a,b)=>distance(s.player,a[1])-distance(s.player,b[1]))[0];
    if(c)return decorate(s,{type:'cabinet',cabinet:c[0],label:'将运输箱放入冷藏柜'});
   }
   if(near(s,s.casePoint)&&s.carriedItem!=='transport-case'&&s.carriedItem!=='leak-container')return decorate(s,{type:SAMPLE_TYPES.includes(s.carriedItem)?'case-load':'install-cooling',item:s.carriedItem,label:'放入运输箱'});
   return decorate(s,{type:'drop',label:'原地放下手持物'});
  }
  if(active){
   const target=DEVICES.find(d=>d.id===s.alarm.device);
   if(near(s,target))return decorate(s,{type:'device-off',label:'关闭故障设备电源'});
   return null;
  }
  if(id==='rf07-2'){
   const c=Object.entries(BASE.coldCabinets).map(([k,p])=>({k,p:{x:10.31,z:p.assetZ}})).filter(c=>near(s,c.p)).sort((a,b)=>distance(s.player,a.p)-distance(s.player,b.p))[0];
   return c?decorate(s,{type:'cabinet-power',cabinet:c.k,label:s.cabinetPower[c.k]?'关闭冷藏':'启动冷藏'}):null;
  }
  const choices=[];
  for(const k of SAMPLE_TYPES)if(['storage','floor'].includes(s.samples[k].location)&&near(s,s.samples[k]))choices.push(decorate(s,{type:'sample',item:k,label:'拿起样本 '+SAMPLE_META[k].code}));
  if(['prep-room','floor'].includes(s.coolingModuleLocation)&&near(s,s.modulePoint))choices.push(decorate(s,{type:'cooling-module',label:'拿起冷却模块'}));
  if(!s.delivered&&near(s,s.casePoint)){
   let type=s.casePhase==='floor'?'case-pickup':s.casePhase==='misordered'?'case-unload':s.casePhase==='cooled'?'case-seal':s.casePhase==='sealed'?'case-activate':s.casePhase==='active'?'case-pickup':null;
   if(type)choices.push(decorate(s,{type,label:({'case-pickup':'拿起运输箱','case-unload':'取出箱顶样本','case-seal':'关闭运输箱','case-activate':'启动温控'})[type]}));
  }
  return choices.sort((a,b)=>distance(s.player,a.point)-distance(s.player,b.point))[0]??null;
 }
 function interact(s,selected){
  const a=selected??getInteraction(s),n=clone(s);if(!a||n.failed||n.complete||n.settling)return n;
  // Animated selections are revalidated at contact: an alarm may interrupt an earlier operation.
  const active=n.alarm.status==='active';
  if(active&&!['drop','device-off'].includes(a.type)){n.lastEvent='alarm_priority';return n;}
  if(!near(n,a.point??pointFor(n,a)))return n;
  const reward=(key,value)=>{if(!n.rewards.includes(key)){n.rewards.push(key);n.progress=Math.min(100,n.progress+value);}};
  n.interactions++;if(id!=='rf07-2')n.progress=Math.max(0,n.progress-5);
  n.lastEvent=a.type;
  if(a.type==='cabinet-power')n.cabinetPower[a.cabinet]=!n.cabinetPower[a.cabinet];
  else if(a.type==='device-off'&&active&&n.alarm.type==='device'){n.alarm.status='resolved';reward('alarm',30);}
  else if(a.type==='drop'&&n.carriedItem){
   const p={...(a.point??front(n)),y:0},k=n.carriedItem;
   const probe={...n,carriedItem:null};
   if(!isWalkable(probe,p.x,p.z)){n.lastEvent='blocked_drop';return n;}
   if(SAMPLE_TYPES.includes(k))n.samples[k]={...p,location:'floor'};
   else if(k==='cooling-module'){n.modulePoint=p;n.coolingModuleLocation='floor';}
   else if(k==='transport-case'){n.casePoint=p;n.casePhaseBeforeDrop=n.casePhase==='floor'?n.casePhaseBeforeDrop:n.casePhase;n.casePhase='floor';}
   else {n.containerPoint=p;n.containerLocation='floor';}
   n.carriedItem=null;
  }else if(a.type==='sample'&&!n.carriedItem&&['storage','floor'].includes(n.samples[a.item].location)){n.samples[a.item].location='carried';n.carriedItem=a.item;reward('pickup-'+a.item,15);}
  else if(a.type==='cooling-module'&&!n.carriedItem){n.carriedItem='cooling-module';n.coolingModuleLocation='carried';reward('pickup-module',15);}
  else if(a.type==='case-load'&&SAMPLE_TYPES.includes(n.carriedItem)){
   const k=n.carriedItem;n.caseSamples.push(k);n.samples[k].location='case';n.carriedItem=null;reward('load-'+k,40);
   n.casePhase=n.caseSamples.every((k,i)=>k===BASE.requiredOrder[i])?(n.caseSamples.length===3?'ordered':'loading'):'misordered';if(n.casePhase==='ordered')reward('ordered',15);
  }else if(a.type==='case-unload'&&!n.carriedItem&&n.caseSamples.length){const k=n.caseSamples.pop();n.carriedItem=k;n.samples[k].location='carried';n.casePhase=n.caseSamples.every((k,i)=>k===BASE.requiredOrder[i])?'loading':'misordered';}
  else if(a.type==='install-cooling'){if(n.casePhase==='ordered'&&n.carriedItem==='cooling-module'){n.carriedItem=null;n.coolingModuleLocation='case';n.casePhase='cooled';reward('cooling',15);}else n.lastEvent='order_required';}
  else if(a.type==='case-seal'&&n.casePhase==='cooled')n.casePhase='sealed';
  else if(a.type==='case-activate'&&n.casePhase==='sealed'){n.casePhase='active';reward('temperature',15);}
  else if(a.type==='case-pickup'&&!n.carriedItem&&['floor','active'].includes(n.casePhase)){n.carriedItem='transport-case';if(n.casePhase==='floor')n.casePhase=n.casePhaseBeforeDrop??'active';}
  else if(a.type==='cabinet'&&n.carriedItem==='transport-case'){if(a.cabinet==='cold-02'&&n.cabinetPower[a.cabinet]){n.carriedItem=null;n.delivered=true;n.casePhase='delivered';reward('delivered',100);}else n.lastEvent='wrong_cabinet';}
  n.motion=n.carriedItem?'carrying':'idle';
  n.complete=id==='rf07-2'?Object.values(n.cabinetPower).every(Boolean):n.carriedItem==='transport-case'&&n.casePhase==='active'&&n.caseSamples.length===3&&(id!=='rf07-3'||n.alarm.status==='resolved');
  if(n.progress<=0&&!n.complete){n.failed=true;n.lastEvent='progress_depleted';}return n;
 }
 return {LEVEL,createInitialState,isWalkable,updateMovement,advanceClock,updateEnvironment,getInteraction,interact,pointFor,closeTerminal:clone,getObjective:s=>({step:0,title:s.failed?'任务失败':s.complete?'任务完成':OBJECTIVES[id],detail:s.failed?(s.lastEvent==='alarm_timeout'?'泄漏未及时处理。':'状态余量已耗尽。'):''})};
}
