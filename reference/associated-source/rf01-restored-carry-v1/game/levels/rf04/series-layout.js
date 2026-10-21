import { DOORFRAME_COLLIDERS } from "./doorframe-layout.js";
import { ARCHITECTURE_COLLIDERS } from "./architecture-layout.js";
import { LEVEL as BASE } from "./level.js";
export const REVISION = "rf04-series-v2";
export const ASSET_ROOT = "/local-assets/levels/rf04/series-v1";
export const STORAGE = Object.freeze({ x: -1.95, z: 6.55, yaw: Math.PI, width: 2.7, depth: .55, height: 1.25 });
export const BAYS = Object.freeze(Object.fromEntries(["shirt","pants","towel"].map((type,i)=>[type,{ x: STORAGE.x + (.9-i*.9), y: .77, z: STORAGE.z-.32, yaw: Math.PI, name: ["上衣","长裤","毛巾"][i] }])));
export const DOCK = Object.freeze({ x: -8.55, z: 6.50, yaw: Math.PI, y: .012 });
export const VACUUM = Object.freeze({ radius: .175, height: .095, speed: BASE.moveSpeed, start: { x:-7.70,z:5.25,yaw:Math.PI*.7 } });
export const EXTRA_COLLIDERS = Object.freeze([
 {id:"laundry-storage", minX:STORAGE.x-1.35,maxX:STORAGE.x+1.35,minZ:STORAGE.z-.275,maxZ:STORAGE.z+.275},
 {id:"vacuum-dock",minX:DOCK.x-.23,maxX:DOCK.x+.23,minZ:DOCK.z+.10,maxZ:DOCK.z+.30},
]);
export const SHARED_COLLIDERS = Object.freeze([...ARCHITECTURE_COLLIDERS,...DOORFRAME_COLLIDERS,...BASE.staticColliders.filter(c=>!c.id.startsWith("generated-wall-")),...EXTRA_COLLIDERS]);
export const DRY_SECONDS = 8;
export const LABELS = { shirt:"上衣",pants:"长裤",towel:"毛巾","wet-batch":"湿衣物",vacuum:"扫地机器人" };
export const dist = (a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function clearCircle(x,z,r=.32) {
 const b=BASE.bounds;
 return x-r>=b.minX&&x+r<=b.maxX&&z-r>=b.minZ&&z+r<=b.maxZ&&!SHARED_COLLIDERS.some(c=>(x-Math.max(c.minX,Math.min(x,c.maxX)))**2+(z-Math.max(c.minZ,Math.min(z,c.maxZ)))**2<r*r);
}
export function lineClear(a,b,r=.02) {
 const n=Math.max(1,Math.ceil(dist(a,b)/.03));
 for(let i=1;i<=n;i++) if(!clearCircle(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n,r))return false;
 return true;
}
