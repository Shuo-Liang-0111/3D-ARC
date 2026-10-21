import {WRENCH_GRIP} from "./wrench-grip.js";
import {isWalkable,updateMovement} from "./series-collision.js";
import {ITEM_META, ITEM_TYPES} from "./level.js";
import {LEVEL as BASE,ITEM_BASE_Y,toolHomes} from "./home-layout.js";
import { createInitialState as initial, cloneState, distance } from "./engine.js";
export { distance, isWalkable, updateMovement };
export const REVISION="rf06-home-v3";
export const OBJECTIVES={
 rf06:"关闭漏水阀门，接住残水、清理积水并归还工具。",
 "rf06-2":"止住漏水，清除扩散的积水并归还工具。",
};
export function createLeakEngine(id){
 if(!["rf06","rf06-2"].includes(id))throw new Error("Level withdrawn for redesign: "+id);
 const mode=id==="rf06"?1:2;
 const LEVEL=Object.freeze({...BASE,id,items:toolHomes(id),interactionRange:1.25});
 const createInitialState=()=>({...initial(),items:Object.fromEntries(ITEM_TYPES.map(type=>[type,{type,location:"room",...LEVEL.items[type]}])),mode,residual:0,water:3,totalLeaked:0,cleanedWater:0,rewards:{},settling:false,revision:REVISION});
 function updateEnvironment(state,delta){
  if(state.complete||state.failed)return state;
  const s=cloneState(state),dt=Math.min(.1,Math.max(0,delta));s.residual=Math.max(0,(state.residual??0)-dt);
  if(state.settling||mode===1||state.valveClosed)return s;
  const litres=dt*.16;
  s.totalLeaked+=litres;
  s.water+=litres;
  s.puddleClean=s.water<.001;return s;
 }
 const point=(x,y,z)=>({x,y,z});
 function getInteraction(s){
  if(s.complete||s.failed||s.settling)return null;
  const candidates=[],add=(type,p,label,extra={})=>{
   const d=distance(s.player,p);if(d<=LEVEL.interactionRange)candidates.push({type,point:p,label,...extra,distance:d});
  };
  if(!s.carriedItem){
   for(const type of ITEM_TYPES){const item=s.items[type];if(["room","floor"].includes(item.location))
    add("pickup",point(item.x+(type==="wrench"?WRENCH_GRIP.x:0),ITEM_BASE_Y(type,item)+(type==="mop"?.82:type==="bucket"?.43:WRENCH_GRIP.y),item.z),"拿起"+ITEM_META[type].shortName,{item:type});}
  }else{
   const t=s.carriedItem;
   if(t==="wrench"&&!s.valveClosed)add("valve",point(BASE.valve.x,BASE.valve.y,BASE.valve.z),"关闭阀门");
   if(t==="bucket"){
    if(!s.bucketPlaced)add("bucket-place",point(BASE.bucketDrop.x,.43,BASE.bucketDrop.z),"放桶接水",{blocked:mode===1&&!s.valveClosed});
   }
   if(t==="mop"&&s.water>.001)add("mop",point(BASE.puddle.x,.85,BASE.puddle.z),"拖净积水",{blocked:!s.bucketPlaced});
   if((t==="wrench"&&s.valveClosed)||(t==="mop"&&s.puddleClean))
    add("return",point(LEVEL.items[t].x+(t==="wrench"?WRENCH_GRIP.x:0),ITEM_BASE_Y(t,{...LEVEL.items[t],location:"returned"})+(t==="mop"?.82:WRENCH_GRIP.y),LEVEL.items[t].z),"归还"+ITEM_META[t].shortName,{item:t});
  }
  candidates.sort((a,b)=>a.distance-b.distance);
  if(candidates.length)return candidates[0];
  return s.carriedItem?{type:"drop",point:point(s.player.x+Math.sin(s.player.yaw)*.5,s.carriedItem==="mop"?.85:s.carriedItem==="bucket"?.43:.03+WRENCH_GRIP.y,s.player.z+Math.cos(s.player.yaw)*.5),label:"放下"+ITEM_META[s.carriedItem].shortName,item:s.carriedItem}:null;
 }
 function interact(state,selection){
  const action=selection??getInteraction(state),s=cloneState(state);s.rewards={...state.rewards};
  if(!action||s.complete||s.failed)return s;
  if(distance(s.player,action.point)>LEVEL.interactionRange+.1)return s;
  if(action.blocked){s.lastEvent="sequence_required";return s;}
  const reward=key=>{if(!s.rewards[key]){s.rewards[key]=true;s.progress=Math.min(100,s.progress+15);}};
  s.interactions++;s.progress=Math.max(0,s.progress-5);
  switch(action.type){
   case "pickup":{const t=action.item;if(s.carriedItem)break;s.carriedItem=t;s.items[t]={type:t,location:"carried"};reward("pickup-"+t);s.lastEvent="picked_up";break;}
   case "valve":if(s.carriedItem!=="wrench")break;s.valveClosed=true;s.residual=12;reward("valve");s.lastEvent="valve_closed";break;
   case "bucket-place":if(s.carriedItem!=="bucket")break;s.bucketPlaced=true;s.carriedItem=null;s.items.bucket={type:"bucket",location:"placed",...BASE.bucketDrop};reward("bucket");s.lastEvent="bucket_placed";break;
   case "mop":{
    if(s.carriedItem!=="mop"||!s.bucketPlaced)break;
    const removed=mode===1?s.water:Math.min(s.water,3);
    s.water-=removed;s.cleanedWater+=removed;
    s.puddleClean=s.water<.001;if(s.puddleClean)reward("clean");s.lastEvent=s.puddleClean?"puddle_cleaned":"mop_pass";break;
   }
   case "return":{const t=s.carriedItem;if(!t)break;s.items[t]={type:t,location:"room",...LEVEL.items[t]};s.carriedItem=null;s.returned[t]=true;s.items[t].location="returned";reward("return-"+t);s.lastEvent="tool_returned";break;}
   case "drop":{const t=s.carriedItem;if(!t)break;if(!isWalkable(s,action.point.x,action.point.z)){s.lastEvent="blocked_drop";break;}s.items[t]={type:t,location:"floor",x:action.point.x-(t==="wrench"?WRENCH_GRIP.x:0),z:action.point.z};s.carriedItem=null;s.lastEvent="dropped";break;}
  }
  s.complete=s.valveClosed&&s.bucketPlaced&&s.puddleClean&&s.returned.wrench&&s.returned.mop;
  if(s.complete){s.progress=100;s.lastEvent="leak_resolved";}
  if(s.progress<=0&&!s.complete){s.failed=true;s.lastEvent="progress_depleted";}
  return s;
 }
 return {LEVEL,mode,createInitialState,updateEnvironment,updateMovement,isWalkable,getInteraction,interact,closeTerminal:cloneState,getObjective:s=>({step:0,title:s.complete?"漏水处理完成":s.failed?"任务失败":"家庭漏水处理",detail:OBJECTIVES[id]})};
}
