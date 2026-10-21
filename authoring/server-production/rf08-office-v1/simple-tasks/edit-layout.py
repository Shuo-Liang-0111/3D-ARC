from pathlib import Path
p=Path('game/levels/rf09/office-layout.js');s=p.read_text().replace('rf08-office-v1-realism','rf08-office-v2-simple')
a=s.index('export const OBJECTIVES=');b=s.index('export const POINTS=',a)
s=s[:a]+'''export const OBJECTIVES={rf09:"在会议桌摆好一份文件和一瓶水","rf09-2":"将挡路椅子推到会议桌前，并摆好一份文件和一瓶水","rf09-3":"推椅并摆好文件和水，来电后 30 秒内接听电话"};
export const TASK_ITEMS=["docs-1","water-1"];
export const PHONE_SECONDS=30;
export const PHONE_POINT={x:-5.57,y:1.015,z:-3.52};
export const DOOR_HALF_WIDTH=.70;
'''+s[b:]
a=s.index('export const SEATS=');b=s.index('export const TYPES=',a)
s=s[:a]+'''export const SEATS=[{id:"1",doc:{x:-3.15,y:.79,z:-3.97},water:{x:-2.76,y:.79,z:-3.98}}];
export const CHAIRS={
 "chair-a":{id:"chair-a",x:0,z:-2.10,yaw:Math.PI,target:{x:0,z:-3.60,yaw:Math.PI},width:.60,depth:.62,handleY:.94},
 "chair-b":{id:"chair-b",x:3,z:-3.45,yaw:Math.PI,target:{x:3,z:-3.45,yaw:Math.PI},width:.60,depth:.62,handleY:.94},
};
'''+s[b:]
s=s.replace('...ORIGINAL.staticColliders.filter(r=>!r.id.startsWith("cubicle")),','''...ORIGINAL.staticColliders.filter(r=>!r.id.startsWith("cubicle")).map(r=>r.id==="conference-glass-west"?{...r,maxX:-DOOR_HALF_WIDTH}:r.id==="conference-glass-east"?{...r,minX:DOOR_HALF_WIDTH}:r),''')
a=s.index('export function initialItems(')
s=s[:a]+'''export function initialItems(){
 const items={
 folder:{id:"folder",type:"folder",...HOME.folder,location:"surface"},
 tray:{id:"tray",type:"tray",...HOME.tray,location:"surface"},
 remote:{id:"remote",type:"remote",...HOME.remote,location:"surface"},
 paper:{id:"paper",type:"paper",...POINTS.paper,location:"surface"},
 printed:{id:"printed",type:"printed",...POINTS.printerOutput,location:"printer",available:false},
 used:{id:"used",type:"used",x:-4.12,y:.79,z:-5.65,location:"surface"},
 };
 for(let i=1;i<=4;i++){
  items["docs-"+i]={id:"docs-"+i,type:"documents",x:-10.30+(i-1)*.36,y:.965,z:4.42,location:"surface"};
  items["water-"+i]={id:"water-"+i,type:"water",x:-8.99+(i-1)*.17,y:.965,z:4.38,location:"surface"};
 }
 for(let i=5;i<=6;i++)items["water-"+i]={id:"water-"+i,type:"water",x:9.22+(i-5)*.25,y:.965,z:4.03,location:"surface"};
 // Only this pair is interactive. All three levels retain the same decorative inventory.
 Object.assign(items["docs-1"],{x:-.95,z:5.22});
 Object.assign(items["water-1"],{x:-.50,z:5.22});
 return items;
}
'''
p.write_text(s)
# The extra glazing visibly narrows the existing opening; collision uses the same dimension.
p=Path('game/levels/rf09/office-architecture.js');s=p.read_text().replace("import * as THREE from 'three';","import * as THREE from 'three';\nimport {DOOR_HALF_WIDTH} from './office-layout.js';")
needle=' // Conference feature wall:'
idx=s.index(needle)
s=s[:idx]+''' // Extend the partition into the former wide opening, retaining one clear doorway.
 for(const sign of [-1,1]){
  const width=2.3-DOOR_HALF_WIDTH,x=sign*(2.3+DOOR_HALF_WIDTH)/2;
  cube(root,[width,2.78,.06],[x,1.39,-2.1],glass).castShadow=false;
  for(const y of [.025,2.80])cube(root,[width,.045,.085],[x,y,-2.1],trim);
  cube(root,[.035,2.78,.075],[sign*DOOR_HALF_WIDTH,1.39,-2.1],trim);
  cube(root,[width,.10,.063],[x,1.18,-2.1],new THREE.MeshStandardMaterial({color:0xd7e0db,transparent:true,opacity:.4,roughness:.65}));
 }
'''+s[idx:];p.write_text(s)
