import { LEVEL as ORIGINAL } from "./level.js";
export const REVISION="rf08-office-v5-free-order";
export const IDS=["rf09","rf09-2","rf09-3"];
export const LABELS={rf09:"RF-08","rf09-2":"RF-08-2","rf09-3":"RF-08-3"};
export const OBJECTIVES={rf09:"在会议桌摆好一份文件和一瓶水","rf09-2":"摆好一份文件和一瓶水，将挡路椅子推回黄框（顺序不限）","rf09-3":"摆好文件和水、椅子归位（顺序不限）；来电后 30 秒内接听"};
export const TASK_ITEMS=[...Array.from({length:8},(_,i)=>`docs-${i+1}`),...Array.from({length:10},(_,i)=>`water-${i+1}`)];
export const PHONE_SECONDS=30;
export const PHONE_START_DELAY_MIN=60;
export const PHONE_START_DELAY_MAX=90;
// Feet contact the measured reception desk worktop at 0.838 m.
export const PHONE_PLACEMENT={x:1.2,y:.841,z:6.25};
export const PHONE_POINT={x:PHONE_PLACEMENT.x+.081,y:PHONE_PLACEMENT.y+.0975,z:PHONE_PLACEMENT.z+.105};
export const CONFERENCE_LAYOUT={centerZ:-5.15,chairXs:[-3,-1,1,3],southZ:-3.60,northZ:-6.70};
export const DOOR_HALF_WIDTH=.70;
export const POINTS={
 archive:{x:-10.85,y:.965,z:4.4},reception:{x:-1.5,y:.965,z:5.22},
 equipment:{x:8.85,y:.965,z:3.95},supplies:{x:-8.75,y:.965,z:4.38},
 printer:{x:6.5,y:.93,z:5.25},printerButton:{x:6.28,y:1.02,z:4.95},
 printerInput:{x:6.5,y:.79,z:4.90},printerOutput:{x:6.5,y:1.02,z:5.03},
 paper:{x:8.45,y:.965,z:4.02},delivery:{x:4.12,y:.79,z:-5.65},
 refill:{x:4.12,y:.79,z:-4.45},recycle:{x:-2.25,y:.965,z:5.22},
 terminal:{x:-5.65,y:1.12,z:-3.61},
};
export const SEATS=[
 ...CONFERENCE_LAYOUT.chairXs.map((x,i)=>({id:String(i+1),doc:{x:x-.15,y:.79,z:-3.97},water:{x:x+.24,y:.79,z:-3.98}})),
 ...CONFERENCE_LAYOUT.chairXs.map((x,i)=>({id:String(i+5),doc:{x:x+.15,y:.79,z:-6.33},water:{x:x-.24,y:.79,z:-6.32}})),
];
export const TARGET_SEAT_ID="1";
export const CHAIRS={
 "chair-a":{id:"chair-a",x:0,z:-2.10,yaw:Math.PI,target:{x:-3,z:-3.60,yaw:Math.PI},width:.60,depth:.62,handleY:.94},
 "chair-b":{id:"chair-b",x:3,z:-3.60,yaw:Math.PI,target:{x:3,z:-3.60,yaw:Math.PI},width:.60,depth:.62,handleY:.94},
};
export const TYPES={
 folder:{name:"蓝色文件夹",size:[.30,.035,.24],grip:.028,color:0x245b80},
 tray:{name:"文件托盘",size:[.36,.065,.27],grip:.070,color:0x464d55},
 remote:{name:"会议遥控器",size:[.08,.035,.18],grip:.025,color:0x292b2d},
 documents:{name:"会议资料",size:[.24,.025,.31],grip:.025,color:0xe9e5d9},
 water:{name:"瓶装水",size:[.07,.23,.07],grip:.12,color:0x98bac5},
 paper:{name:"A4 纸",size:[.21,.055,.297],grip:.04,color:0xebece6},
 printed:{name:"补充资料",size:[.24,.03,.31],grip:.025,color:0xe6e2d8},
 used:{name:"会后资料",size:[.25,.045,.31],grip:.03,color:0xc7c6ba},
};
export const HOME={folder:POINTS.archive,tray:POINTS.reception,remote:POINTS.equipment};
export const rect=(id,x,z,w,d)=>({id,minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
export const STATIC=[
 ...[-7.6,7.6].map((x,i)=>rect("conference-planter-"+i,x,-8.25,.64,.64)),
 ...ORIGINAL.staticColliders.filter(r=>!r.id.startsWith("cubicle")).map(r=>r.id==="conference-glass-west"?{...r,maxX:-DOOR_HALF_WIDTH}:r.id==="conference-glass-east"?{...r,minX:DOOR_HALF_WIDTH}:r),
 ...[-9.05,4,9.05].map((x,i)=>rect("cubicle-"+i,x,1.55,3.4,1.45)),
 rect("admin-counter",-9.7,4.68,2.8,.70),rect("it-counter",8.8,4.29,2.65,.60),
 rect("returns-counter",-1.65,5.3,2.8,.6),rect("printer-counter",6.5,5.35,1.3,1.0),
 ...CONFERENCE_LAYOUT.chairXs.map((x,i)=>rect("north-chair-"+i,x,CONFERENCE_LAYOUT.northZ,.60,.62)),
 ...CONFERENCE_LAYOUT.chairXs.slice(1,3).map((x,i)=>rect("south-chair-"+i,x,CONFERENCE_LAYOUT.southZ,.60,.62)),
];
export function makeLevel(id){return {...ORIGINAL,id,title:"Office Services",playerStart:{...ORIGINAL.playerStart},interactionRange:1.25,staticColliders:STATIC,progress:{initial:ORIGINAL.progress.initial,maximum:ORIGINAL.progress.maximum,actionDrainPerSecond:ORIGINAL.progress.actionDrainPerSecond,interactionCost:ORIGINAL.progress.interactionCost,pickupReward:ORIGINAL.progress.pickupReward,placementReward:ORIGINAL.progress.installReward}};}
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function furniturePoint(f,lateral=0,back=.29){return {x:f.x-Math.sin(f.yaw)*back+Math.cos(f.yaw)*lateral,y:f.handleY,z:f.z-Math.cos(f.yaw)*back-Math.sin(f.yaw)*lateral};}
export function chairStand(f){return {...furniturePoint(f,0,.82),yaw:f.yaw};}
export function initialItems(){
 const items={
 folder:{id:"folder",type:"folder",...HOME.folder,location:"surface"},
 tray:{id:"tray",type:"tray",...HOME.tray,location:"surface"},
 remote:{id:"remote",type:"remote",...HOME.remote,location:"surface"},
 paper:{id:"paper",type:"paper",...POINTS.paper,location:"surface"},
 printed:{id:"printed",type:"printed",...POINTS.printerOutput,location:"printer",available:false},
 used:{id:"used",type:"used",x:-4.12,y:.79,z:-5.65,location:"surface"},
 };
 for(let i=1;i<=8;i++){
  items["docs-"+i]={id:"docs-"+i,type:"documents",x:-10.30+(i-1)*.36,y:.965,z:4.42,location:"surface"};
  items["water-"+i]={id:"water-"+i,type:"water",x:-8.99+(i-1)*.17,y:.965,z:4.38,location:"surface"};
 }
 for(let i=9;i<=10;i++)items["water-"+i]={id:"water-"+i,type:"water",x:9.22+(i-9)*.25,y:.965,z:4.03,location:"surface"};
 // Seat 1 is the missing place setting. The other seven seats start furnished.
 Object.assign(items["docs-1"],{x:-.95,z:5.22});
 Object.assign(items["water-1"],{x:-.50,z:5.22});
 for(let i=1;i<SEATS.length;i++){
  Object.assign(items[`docs-${i+1}`],SEATS[i].doc,{seatId:SEATS[i].id,yaw:i>=4?Math.PI:0});
  Object.assign(items[`water-${i+1}`],SEATS[i].water,{seatId:SEATS[i].id});
 }
 return items;
}
