import { LEVEL as ORIGINAL } from "./level.js";
export const REVISION="rf08-office-v1-realism";
export const IDS=["rf09","rf09-2","rf09-3"];
export const LABELS={rf09:"RF-08","rf09-2":"RF-08-2","rf09-3":"RF-08-3"};
export const OBJECTIVES={rf09:"将文件夹、文件托盘和会议遥控器归还正确位置","rf09-2":"布置四个会议席位、将两张会议椅归位，并确认会场就绪","rf09-3":"完成会议期间的打印配送、饮水补给和资料回收"};
export const POINTS={
 archive:{x:-10.85,y:.965,z:4.4},reception:{x:-1.5,y:.965,z:5.22},
 equipment:{x:8.85,y:.965,z:3.95},supplies:{x:-8.75,y:.965,z:4.38},
 printer:{x:6.5,y:.93,z:5.25},printerButton:{x:6.28,y:1.02,z:4.95},
 printerInput:{x:6.5,y:.79,z:4.90},printerOutput:{x:6.5,y:1.02,z:5.03},
 paper:{x:8.45,y:.965,z:4.02},delivery:{x:4.12,y:.79,z:-5.65},
 refill:{x:4.12,y:.79,z:-4.45},recycle:{x:-2.25,y:.965,z:5.22},
 terminal:{x:-5.65,y:1.12,z:-3.61},
};
export const SEATS=[-3,-1,1,3].map((x,i)=>({id:String(i+1),doc:{x:x+.20,y:.79,z:-6.35},water:{x:x+.55,y:.79,z:-6.30}}));
export const CHAIRS={
 "chair-a":{id:"chair-a",x:-3.60,z:-3.45,yaw:Math.PI,target:{x:-3,z:-3.45,yaw:Math.PI},width:.60,depth:.62,handleY:.94},
 "chair-b":{id:"chair-b",x:3.60,z:-3.45,yaw:Math.PI,target:{x:3,z:-3.45,yaw:Math.PI},width:.60,depth:.62,handleY:.94},
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
 ...ORIGINAL.staticColliders.filter(r=>!r.id.startsWith("cubicle")),
 ...[-9.05,-4,4,9.05].map((x,i)=>rect("cubicle-"+i,x,1.55,3.4,1.45)),
 rect("admin-counter",-9.7,4.68,2.8,.70),rect("it-counter",8.8,4.29,2.65,.60),
 rect("returns-counter",-1.65,5.3,2.8,.6),rect("printer-counter",6.5,5.35,1.3,1.0),rect("meeting-terminal",-5.65,-3.8,.9,.75),
 ...[-3,-1,1,3].map((x,i)=>rect("north-chair-"+i,x,-7.80,.60,.62)),
 ...[-1,1].map((x,i)=>rect("south-chair-"+i,x,-3.25,.60,.62)),
];
export function makeLevel(id){return {...ORIGINAL,id,title:"Office Services",playerStart:{...ORIGINAL.playerStart},interactionRange:1.25,staticColliders:STATIC,progress:{initial:100,maximum:100,actionDrainPerSecond:0,interactionCost:0}};}
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function furniturePoint(f,lateral=0,back=.29){return {x:f.x-Math.sin(f.yaw)*back+Math.cos(f.yaw)*lateral,y:f.handleY,z:f.z-Math.cos(f.yaw)*back-Math.sin(f.yaw)*lateral};}
export function chairStand(f){return {...furniturePoint(f,0,.82),yaw:f.yaw};}
export function initialItems(id){
 const base=id==="rf09",service=id==="rf09-3";
 const items={
 folder:{id:"folder",type:"folder",...(base?{x:-4,y:.84,z:2.16}:HOME.folder),location:"surface"},
 tray:{id:"tray",type:"tray",...(base?{x:-4.12,y:.79,z:-4.60}:HOME.tray),location:"surface"},
 remote:{id:"remote",type:"remote",...(base?{x:4,y:.84,z:2.16}:HOME.remote),location:"surface"},
 paper:{id:"paper",type:"paper",...POINTS.paper,location:"surface"},
 printed:{id:"printed",type:"printed",...POINTS.printerOutput,location:"printer",available:false},
 used:{id:"used",type:"used",x:-4.12,y:.79,z:-5.65,location:"surface"},
 };
 for(let i=1;i<=4;i++){
 items["docs-"+i]={id:"docs-"+i,type:"documents",...(service?SEATS[i-1].doc:{x:-10.30+(i-1)*.36,y:.965,z:4.42}),location:"surface"};
 items["water-"+i]={id:"water-"+i,type:"water",...(service?SEATS[i-1].water:{x:-8.99+(i-1)*.17,y:.965,z:4.38}),location:"surface"};
 }
 for(let i=5;i<=6;i++)items["water-"+i]={id:"water-"+i,type:"water",x:9.22+(i-5)*.25,y:.965,z:4.03,location:"surface"};
 return items;
}
