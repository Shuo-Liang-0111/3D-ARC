import { LEVEL as BASE } from "./level.js";
export const REVISION = "rf05-series-v03";
export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export const objectives = {
 rf05: "将旧毛巾、水杯和垃圾分别回收，完成客房整理。",
 "rf05-2": "回收旧物，并为双床客房补齐两套干净毛巾和水杯。",
 "rf05-3": "完成客房回收补给、淋浴止漏、积水清理及家具归位，确认客房可交付。",
};
export const STOCK = {
 towel1:{type:"towel",x:.965,y:1.005,z:2.9}, towel2:{type:"towel",x:.965,y:1.145,z:2.9},
 cup1:{type:"cup",x:1.38,y:1.005,z:2.9}, cup2:{type:"cup",x:1.38,y:1.005,z:3.06},
};
export const ROOM_FIXTURES = {
 bedLeft:{x:-2.30,z:-3.45},bedRight:{x:.30,z:-3.45},
 bedside:{x:-1,z:-4.35},toilet:{x:-1.55,y:.031,z:3.65,yaw:-Math.PI/2},ceilingY:2.86,
};
export const SLOTS = {
 towel1:{type:"towel",x:-2.30,y:.414,z:-2.55},
 towel2:{type:"towel",x:.30,y:.414,z:-2.55},
 cup1:{type:"cup",x:3.40,y:.78,z:-2.42},
 cup2:{type:"cup",x:3.40,y:.78,z:-1.26},
};
export const DIRTY = {
 towel:{type:"towel",x:-2.30,y:.414,z:-2.55},
 cup:{type:"cup",x:-1,y:.544,z:-4.20},
 trash:{type:"trash",x:2.15,y:.025,z:.2},
};
export const TARGETS = {
 laundry:{x:-2.15,y:.55,z:2.35},
 cart:{x:1.38,y:1.005,z:2.74},
 bin:{x:3.45,y:.45,z:4.5},
};
export const EXIT = {x:.40,y:1.12,z:5.08};
export const FURNITURE = {
 cart:{x:1.05,z:2.9,yaw:0,width:.95,depth:.58,height:1.05,handleY:.96,handleBack:.39,handleHalfWidth:.24,standBack:.84,target:{x:1.4,z:4.48,yaw:0}},
 chair:{x:2.45,z:-.76,yaw:Math.PI/2,width:.58,depth:.58,height:.90,handleY:.84,handleBack:.258,handleHalfWidth:.19,standBack:.76,target:{x:2.82,z:-1.87,yaw:Math.PI/2}},
};
export const FIXED = BASE.staticColliders.filter(r=>!["desk-chair","cleaning-cart","trash-bin","bathroom-vanity","desk","bed-left","bed-right","nightstand","toilet","bathroom-shower"].includes(r.id)).concat([
 {id:"bed-left",minX:-3.23,maxX:-1.37,minZ:-4.775,maxZ:-2.125},
 {id:"bed-right",minX:-.63,maxX:1.23,minZ:-4.775,maxZ:-2.125},
 {id:"nightstand",minX:-1.275,maxX:-.725,minZ:-4.575,maxZ:-4.125},
 {id:"desk",minX:3.12,maxX:3.78,minZ:-2.69,maxZ:-1.05},
 {id:"bathroom-vanity",minX:-4.0,maxX:-3.24,minZ:3.3,maxZ:4.60},
 {id:"shower-glass",minX:-1.53,maxX:-1.47,minZ:4.12,maxZ:5.17},
 {id:"shower-post",minX:-3.00,maxX:-2.92,minZ:4.085,maxZ:4.155},
 {id:"shower-fixture",minX:-2.58,maxX:-1.92,minZ:5.01,maxZ:5.20},
 {id:"toilet",minX:-1.90,maxX:-1.20,minZ:3.44,maxZ:3.86},
 {id:"handover-post",minX:.41,maxX:.53,minZ:5.03,maxZ:5.13},
 {id:"trash-bin",minX:3.18,maxX:3.72,minZ:4.23,maxZ:4.77},
]);
export function makeLevel(id){return {...BASE,id,title:"Hotel Room Service",interactionRange:1.3,staticColliders:FIXED,targets:TARGETS};}
export function furniturePoint(f,x,y,z){return {x:f.x+Math.cos(f.yaw)*x+Math.sin(f.yaw)*z,y,z:f.z-Math.sin(f.yaw)*x+Math.cos(f.yaw)*z};}
export function standForFurniture(f){return {...furniturePoint(f,0,0,-f.standBack),yaw:f.yaw};}
export function furnitureRect(f,padding=0){const w=f.width/2+padding,d=f.depth/2+padding,c=Math.abs(Math.cos(f.yaw)),s=Math.abs(Math.sin(f.yaw));return {id:f.id,minX:f.x-c*w-s*d,maxX:f.x+c*w+s*d,minZ:f.z-s*w-c*d,maxZ:f.z+s*w+c*d};}
export function stockPose(id,state){const item=STOCK[id],f=state.furniture.cart;return furniturePoint(f,item.x-FURNITURE.cart.x,item.y,item.z-FURNITURE.cart.z);}
export function itemPose(id,state){const i=state.items[id];if(i.location==="stock")return stockPose(id,state);if(i.location==="room"||i.location==="floor")return i;
 if(i.location==="slot")return SLOTS[i.slot];
 if(i.location==="cart")return furniturePoint(state.furniture.cart,.33,1.005,-.16);
 return TARGETS[i.location]??i;}
