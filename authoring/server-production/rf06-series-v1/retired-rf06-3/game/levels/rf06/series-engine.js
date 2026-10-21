import { LEVEL as BASE, ITEM_META, ITEM_TYPES } from "./level.js";
import { createInitialState as initial, cloneState, distance, isWalkable, updateMovement } from "./engine.js";
export { distance, isWalkable, updateMovement };
export const REVISION="rf06-series-v1";
export const DRAIN=Object.freeze({x:-4.03,y:.015,z:2.53});
export const CAPACITY=6;
export const OBJECTIVES={
 rf06:"关闭漏水阀门，接住残水、清理积水并归还工具。",
 "rf06-2":"止住漏水，清除扩散的积水并归还工具。",
 "rf06-3":"止住漏水，管理接水与倒水，清除积水并将全部工具归位。"
};
export function createLeakEngine(id){
 const mode=id==="rf06"?1:id==="rf06-2"?2:3;
 const LEVEL=Object.freeze({...BASE,id,interactionRange:1.25});
 const createInitialState=()=>({...initial(),mode,water:mode===3?8:3,bucketWater:0,totalLeaked:0,totalDrained:0,cleanedWater:0,rewards:{},bucketReturned:false,settling:false,revision:REVISION});
 function updateEnvironment(state,delta){
  if(state.complete||state.failed||state.settling||mode===1||state.valveClosed)return state;
  const s=cloneState(state),litres=Math.min(.1,Math.max(0,delta))*.16;
  s.totalLeaked+=litres;
  if(mode===3&&s.items.bucket.location==="placed"){
   const caught=Math.min(litres,CAPACITY-s.bucketWater);s.bucketWater+=caught;s.water+=litres-caught;
  }else s.water+=litres;
  s.puddleClean=s.water<.001;return s;
 }
 const point=(x,y,z)=>({x,y,z});
 function getInteraction(s){
  if(s.complete||s.failed||s.settling)return null;
  const candidates=[],add=(type,p,label,extra={})=>{
   const d=distance(s.player,p);if(d<=LEVEL.interactionRange)candidates.push({type,point:p,label,...extra,distance:d});
  };
  if(!s.carriedItem){
   for(const type of ITEM_TYPES){const item=s.items[type];if(["room","floor"].includes(item.location)||(type==="bucket"&&mode===3&&item.location==="placed"))
    add("pickup",point(item.x,type==="mop"?.85:type==="bucket"?.43:.07,item.z),"拿起"+ITEM_META[type].shortName,{item:type});}
  }else{
   const t=s.carriedItem;
   if(t==="wrench"&&!s.valveClosed)add("valve",point(BASE.valve.x,.60,BASE.valve.z),"关闭阀门");
   if(t==="bucket"){
    if(mode===3&&s.bucketWater>.001)add("empty",{...DRAIN,y:.58},"倒空水桶");
    if(!s.bucketPlaced||mode===3&&s.items.bucket.location!=="placed")add("bucket-place",point(BASE.bucketDrop.x,.43,BASE.bucketDrop.z),"放桶接水",{blocked:mode===1&&!s.valveClosed});
    if(mode===3&&s.valveClosed&&s.water<.001&&s.bucketWater<.001)add("return",point(BASE.items.bucket.x,.43,BASE.items.bucket.z),"水桶归位",{item:t});
   }
   if(t==="mop"&&s.water>.001)add("mop",point(BASE.puddle.x,.85,BASE.puddle.z),mode===3?"拖地并将污水拧入水桶":"拖净积水",{blocked:!s.bucketPlaced||(mode===3&&(s.items.bucket.location!=="placed"||s.bucketWater>=CAPACITY-.001))});
   if((t==="wrench"&&s.valveClosed)||(t==="mop"&&s.puddleClean))
    add("return",point(BASE.items[t].x,t==="mop"?.85:.07,BASE.items[t].z),"归还"+ITEM_META[t].shortName,{item:t});
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  if(candidates.length)return candidates[0];
  return s.carriedItem?{type:"drop",point:point(s.player.x+Math.sin(s.player.yaw)*.5,s.carriedItem==="mop"?.85:s.carriedItem==="bucket"?.43:.07,s.player.z+Math.cos(s.player.yaw)*.5),label:"放下"+ITEM_META[s.carriedItem].shortName,item:s.carriedItem}:null;
 }
 function interact(state,selection){
  const action=selection??getInteraction(state),s=cloneState(state);s.rewards={...state.rewards};
  if(!action||s.complete||s.failed)return s;
  if(distance(s.player,action.point)>LEVEL.interactionRange+.1)return s;
  if(action.blocked){s.lastEvent=mode===3?"bucket_unavailable":"sequence_required";return s;}
  const reward=key=>{if(!s.rewards[key]){s.rewards[key]=true;s.progress=Math.min(100,s.progress+15);}};
  s.interactions++;s.progress=Math.max(0,s.progress-5);
  switch(action.type){
   case "pickup":{const t=action.item;if(s.carriedItem)break;s.carriedItem=t;s.items[t]={type:t,location:"carried"};reward("pickup-"+t);s.lastEvent="picked_up";break;}
   case "valve":if(s.carriedItem!=="wrench")break;s.valveClosed=true;reward("valve");s.lastEvent="valve_closed";break;
   case "bucket-place":if(s.carriedItem!=="bucket")break;s.bucketPlaced=true;s.carriedItem=null;s.items.bucket={type:"bucket",location:"placed",...BASE.bucketDrop};s.bucketReturned=false;reward("bucket");s.lastEvent="bucket_placed";break;
   case "mop":{
    if(s.carriedItem!=="mop"||!s.bucketPlaced)break;
    if(mode===3&&(s.items.bucket.location!=="placed"||s.bucketWater>=CAPACITY-.001)){s.lastEvent="bucket_unavailable";break;}
    const removed=mode===1?s.water:Math.min(s.water,mode===3?Math.min(2,CAPACITY-s.bucketWater):3);
    s.water-=removed;s.cleanedWater+=removed;if(mode===3)s.bucketWater+=removed;
    s.puddleClean=s.water<.001;if(s.puddleClean)reward("clean");s.lastEvent=s.puddleClean?"puddle_cleaned":"mop_pass";break;
   }
   case "empty":if(s.carriedItem!=="bucket"||s.bucketWater<.001)break;s.totalDrained+=s.bucketWater;s.bucketWater=0;reward("empty");s.lastEvent="bucket_emptied";break;
   case "return":{const t=s.carriedItem;if(!t)break;s.items[t]={type:t,location:"room",...BASE.items[t]};s.carriedItem=null;if(t==="bucket")s.bucketReturned=true;else{s.returned[t]=true;s.items[t].location="returned";}reward("return-"+t);s.lastEvent="tool_returned";break;}
   case "drop":{const t=s.carriedItem;if(!t)break;if(!isWalkable(s,action.point.x,action.point.z)){s.lastEvent="blocked_drop";break;}s.items[t]={type:t,location:"floor",x:action.point.x,z:action.point.z};s.carriedItem=null;s.lastEvent="dropped";break;}
  }
  s.complete=s.valveClosed&&s.bucketPlaced&&s.puddleClean&&s.returned.wrench&&s.returned.mop&&(mode!==3||(s.bucketReturned&&s.bucketWater<.001&&s.totalDrained>0));
  if(s.complete){s.progress=100;s.lastEvent="leak_resolved";}
  if(s.progress<=0&&!s.complete){s.failed=true;s.lastEvent="progress_depleted";}
  return s;
 }
 return {LEVEL,mode,createInitialState,updateEnvironment,updateMovement,isWalkable,getInteraction,interact,closeTerminal:cloneState,getObjective:s=>({step:0,title:s.complete?"漏水处理完成":s.failed?"任务失败":"家庭漏水处理",detail:OBJECTIVES[id]})};
}
