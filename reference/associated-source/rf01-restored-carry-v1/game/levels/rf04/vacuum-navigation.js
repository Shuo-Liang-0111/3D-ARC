import { SHARED_COLLIDERS, VACUUM, clearCircle, lineClear } from "./series-layout.js";
import { ARCHITECTURE_COLLIDERS } from "./architecture-layout.js";

// Outer floor outline: window openings are not floor-level exits.
const outline=[[-9.359,7.164],[6.10,7.164],[9.359,3.95],[9.359,1.22],[7.459,1.22],[7.459,-1.811],[9.359,-1.811],[9.359,-7.279],[3.941,-7.279],[3.941,-6.805],[1.9,-6.805],[.70,-6.55],[-.21,-5.86],[-.95,-4.82],[-1.284,-3.0],[-5.72,-3.0],[-6.50,-2.89],[-7.15,-2.57],[-7.83,-2.06],[-8.37,-1.40],[-8.72,-.63],[-8.884,.79],[-8.884,2.171],[-9.359,2.171]];
const exterior=outline.map((a,i)=>({segment:[a,outline[(i+1)%outline.length]]}));
export function vacuumInside(v){
 let inside=false;
 for(const {segment:[[ax,az],[bx,bz]]} of exterior)if((az>v.z)!==(bz>v.z)&&v.x<(bx-ax)*(v.z-az)/(bz-az)+ax)inside=!inside;
 return inside&&nearest(v.x,v.z,exterior).distance>=VACUUM.radius+.015;
}
const boundaries=[...SHARED_COLLIDERS,...exterior];
const walls=[...ARCHITECTURE_COLLIDERS,...exterior];
const GAP=.12, CLEARANCE=VACUUM.radius+GAP;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
function nearest(x,z,colliders){
 let best={distance:Infinity};
 for(const c of colliders){
  let px,pz;
  if(c.segment){const [[ax,az],[bx,bz]]=c.segment;const t=clamp(((x-ax)*(bx-ax)+(z-az)*(bz-az))/((bx-ax)**2+(bz-az)**2),0,1);px=ax+(bx-ax)*t;pz=az+(bz-az)*t;}
  else{px=clamp(x,c.minX,c.maxX);pz=clamp(z,c.minZ,c.maxZ);}
  const dx=x-px,dz=z-pz,d=Math.hypot(dx,dz);
  if(d<best.distance)best={distance:d,nx:dx/(d||1),nz:dz/(d||1)};
 }
 return best;
}
function safeLine(a,b){
 if(!lineClear(a,b,VACUUM.radius+.015))return false;
 const count=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.03));
 for(let i=1;i<=count;i++)if(!vacuumInside({x:a.x+(b.x-a.x)*i/count,z:a.z+(b.z-a.z)*i/count}))return false;
 return true;
}
export function wallDistance(v){return nearest(v.x,v.z,walls).distance;}

// Follow the real collision boundary with the wall on the right. Furniture becomes
// a temporary boundary where it obstructs the wall; no synthetic patrol rectangle.
export function advanceVacuum(v,player,dt){
 if(v.mode!=="roaming"||dt<=0)return;
 const step=VACUUM.speed*dt;
 let boundary=nearest(v.x,v.z,boundaries);
 if(boundary.distance>.85){
  const wall=nearest(v.x,v.z,walls);
  const target={x:v.x-wall.nx*Math.max(0,wall.distance-CLEARANCE),z:v.z-wall.nz*Math.max(0,wall.distance-CLEARANCE)};
  if(safeLine(v,target))boundary=wall;
 }
 // Tangent plus a bounded correction seeks a wall initially and holds its offset.
 const correction=clamp((CLEARANCE-boundary.distance)*4,-2.5,1);
 const dx=boundary.nz+boundary.nx*correction,dz=-boundary.nx+boundary.nz*correction;
 const desired=Math.atan2(dx,dz);
 let best=null;
 for(let i=0;i<72;i++){
  const yaw=desired+i*Math.PI/36,fx=Math.sin(yaw),fz=Math.cos(yaw);
  const score=Math.abs(angle(yaw-desired))+.25*Math.abs(angle(yaw-v.yaw));
  if(best&&score>=best.score)continue;
  const p={x:v.x+fx*step,z:v.z+fz*step};
  if(!safeLine(v,p)||Math.hypot(p.x-player.x,p.z-player.z)<.48)continue;
  const ahead={x:v.x+fx*Math.max(step,.16),z:v.z+fz*Math.max(step,.16)};
  if(!safeLine(v,ahead))continue;
  if(!best||score<best.score)best={...p,yaw,score};
 }
 if(best){
  const turn=angle(best.yaw-v.yaw);
  // Turn in place for tight corners, then travel at the shared locomotion speed.
  const limit=3.5*dt;v.yaw=angle(v.yaw+clamp(turn,-limit,limit));
  if(Math.abs(turn)<=limit+.01){v.x=best.x;v.z=best.z;}
  if(Math.abs(turn)>.05)v.turn++;
 }
}
