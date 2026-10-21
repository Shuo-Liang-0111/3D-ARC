import { LEVEL as BASE, BALLS, STATIC_COLLIDERS, boundsFor } from "./level.js";
export const REVISION="tennis-series-v1";
export const ASSET_REVISION="series-v1";
export const TYPES={yellow:{name:"黄色标准球",color:0xf3ee38,label:"黄色 · 标准球"},orange:{name:"橙色训练球",color:0xff8332,label:"橙色 · 训练球"}};
export const BINS=[{id:"yellow",x:8.2,y:.64,z:8},{id:"orange",x:8.2,y:.64,z:10}];
export const SHELTER={minX:6.65,maxX:9.95,minZ:-5,maxZ:1,roofY:2.8};
export const POSTS=[[6.85,-4.8],[9.75,-4.8],[6.85,.8],[9.75,.8]].map(([x,z],i)=>({id:"shelter-post-"+i,size:[.12,2.8,.12],position:[x,1.4,z]}));
export const EXTRA_STRUCTURES=[...POSTS,{id:"orange-cart",size:[.65,.95,.65],position:[8.2,.475,10]}];
export const COLLIDERS=[...STATIC_COLLIDERS,...EXTRA_STRUCTURES.map(boundsFor)];
export const SERIES_BALLS=BALLS.map((b,i)=>({...b,type:i%2?"orange":"yellow",name:TYPES[i%2?"orange":"yellow"].name+" "+(Math.floor(i/2)+1)}));
export const WEATHER={dryMin:45,dryMax:90,rainMin:60,rainMax:90,exposureLimit:30};
export const RESERVE={initial:100,maximum:100,drainPerMeter:.4,interactionDrain:2,correctReturnReward:6};
export function seriesLevel(id){return {...BASE,id,revision:REVISION,interactionRange:1.1,staticColliders:COLLIDERS,progress:RESERVE};}
export function sheltered(player,level=BASE){
 const r=level.playerRadius,forward=level.playerForwardOffset;
 return [player,{x:player.x+Math.sin(player.yaw)*forward,z:player.z+Math.cos(player.yaw)*forward}].every(p=>p.x-r>=SHELTER.minX&&p.x+r<=SHELTER.maxX&&p.z-r>=SHELTER.minZ&&p.z+r<=SHELTER.maxZ);
}
export function binPose(id,index){const b=BINS.find(b=>b.id===id);return {x:b.x+(index%2? .095:-.095),y:b.y,z:b.z+(Math.floor(index/2)%4-1.5)*.095};}
