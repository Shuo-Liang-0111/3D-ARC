import {LEVEL as ORIGINAL} from "./level.js";
export const HOME_REVISION="rf06-home-v3";
export const HOME={floorY:.03,ceilingY:2.8,
 faucet:{x:-3.15,y:1.185,z:3.34},sink:{x:-3.15,y:.897,z:3.35,width:.67,depth:.43},
 overflow:{x:-3.15,y:.918,z:3.005},valve:{x:-3.15,y:.57,z:3.16},valveGrip:{x:-3.15,y:.57,z:3.078},
 wrenchShelfY:.82,can:{x:4.80,y:.84,z:1.42}};
const colliders=ORIGINAL.staticColliders.filter(r=>r.id!=="tool-rack"&&r.id!=="kitchen-north-counter").map(r=>r.id==="refrigerator"?{...r,minX:-5.225,maxX:-4.545,minZ:.78,maxZ:1.56}:{...r});
colliders.push({id:"kitchen-north-counter",minX:-4.75,maxX:-1.58,minZ:3.08,maxZ:3.86},
{id:"wrench-shelf",minX:4.55,maxX:5.03,minZ:1.59,maxZ:1.85},
{id:"tool-rack",minX:4.92,maxX:5.18,minZ:1.60,maxZ:2.32},
{id:"pesticide-shelf",minX:4.64,maxX:5.25,minZ:1.28,maxZ:1.58});
export const LEVEL=Object.freeze({...ORIGINAL,
 valve:HOME.valveGrip,leak:HOME.faucet,bucketDrop:{x:-3.15,z:2.88},puddle:{x:-2.55,z:2.40},
 items:{wrench:{x:4.58,z:1.72,home:"tool-rack",supportY:HOME.wrenchShelfY},bucket:{x:3.85,z:2.55,home:"utility-room"},mop:{x:4.98,z:2.22,home:"tool-rack"}},
 staticColliders:Object.freeze(colliders)
});
export const toolHomes=id=>id==="rf06-2"?{
 ...LEVEL.items,
 wrench:{x:4.22,z:-2.70,home:"entry-bench",supportY:.825},
 bucket:{x:-.62,z:2.90,home:"kitchen-hall",supportY:HOME.floorY}
}:LEVEL.items;
export const ITEM_BASE_Y=(type,item)=>["room","returned","tool-rack"].includes(item.location)
 ?(item.supportY??(type==="bucket"?.060:HOME.floorY)):HOME.floorY;
