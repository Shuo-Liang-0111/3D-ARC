import { createSeededRandom } from "../../environment-seed.js";

export const TISSUE_IDS=["tissue1","tissue2","tissue3"];
export const TISSUE={speedMultiplier:2.5,turnInterval:.4,forwardChance:.8,catchRadius:.20,radius:.15,floorY:.018,ceilingY:2.58};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance3=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function createTissues(seed=null){const seeded=seed==null?null:createSeededRandom(seed);return Object.fromEntries(TISSUE_IDS.map((id,i)=>[id,{type:"tissue",location:"air",x:[-1.4,.6,1.65][i],y:[.95,1.4,1.15][i],z:[.05,.6,-1.1][i],heading:[.5,2.5,-1.1][i],pitch:[.25,-.32,.45][i],targetHeading:[.5,2.5,-1.1][i],targetPitch:[.25,-.32,.45][i],turnIn:TISSUE.turnInterval,seed:seeded?Math.floor(seeded()*4294967296):9371+i*719,fallTime:0,clock:i*1.5,turns:0,forwardTurns:0,verticalForwardTurns:0,bounces:0,vx:0,vy:0,vz:0}]));}
export function random(t){t.seed=(Math.imul(t.seed,1664525)+1013904223)>>>0;return t.seed/4294967296;}
export function chooseDirection(t){
 const forward=random(t)<TISSUE.forwardChance;
 t.targetHeading=t.heading+(forward?0:Math.PI)+(random(t)-.5)*Math.PI;
 const verticalForward=random(t)<TISSUE.forwardChance,sign=Math.sign(t.pitch)||1;
 t.targetPitch=sign*(verticalForward?1:-1)*(.10+random(t)*.65);
 t.turns++;if(forward)t.forwardTurns++;if(verticalForward)t.verticalForwardTurns++;
 return {forward,verticalForward};
}
export function tissueRectClear(x,z,colliders,r=TISSUE.radius){return !colliders.some(q=>x>q.minX-r&&x<q.maxX+r&&z>q.minZ-r&&z<q.maxZ+r);}
export function tissueCatchable(s,t){
 if(s.carriedItem||s.attachment||s.actionTarget||!s.catchHand||!["air","falling"].includes(t.location))return false;
 const dx=t.x-s.player.x,dz=t.z-s.player.z;
 return dx*Math.sin(s.player.yaw)+dz*Math.cos(s.player.yaw)>-.02&&distance3(t,s.catchHand)<=TISSUE.catchRadius;
}
export function reserveTissue(s,id){
 const t=s.items[id];if(!t||!tissueCatchable(s,t))return null;
 const n=structuredClone(s);n.items[id].location="catching";n.catchPending=id;n.actionTarget="tissue-catch";return n;
}
export function releaseTissueReservation(s){
 const n=structuredClone(s),t=n.items[n.catchPending];if(t?.location==="catching")t.location=n.wind.latched?"falling":"air";
 n.catchPending=null;return n;
}
export function tissuesDone(s){return TISSUE_IDS.every(id=>s.items[id].location==="bin");}
export function advanceTissue(t,wind,dt,robotSpeed,colliders,bounds,clearance=TISSUE.radius){
 if(!["air","falling"].includes(t.location)||dt<=0)return;
 t.clock+=dt;
 if(wind.latched&&(t.location==="air"||t.location==="falling")){
  if(t.location==="air"){t.location="falling";t.fallTime=0;}
  t.vx=0;t.vz=0;
 }
 if(t.location==="air"){
  t.turnIn-=dt;while(t.turnIn<=1e-9){chooseDirection(t);t.turnIn+=TISSUE.turnInterval;}
  const response=1-Math.exp(-dt*12);
  t.heading+=Math.atan2(Math.sin(t.targetHeading-t.heading),Math.cos(t.targetHeading-t.heading))*response;
  t.pitch+=(t.targetPitch-t.pitch)*response;
  const speed=robotSpeed*TISSUE.speedMultiplier;
  t.vx=Math.sin(t.heading)*Math.cos(t.pitch)*speed;t.vz=Math.cos(t.heading)*Math.cos(t.pitch)*speed;t.vy=Math.sin(t.pitch)*speed;
 }else{
  t.fallTime+=dt;
  t.vx=0;t.vz=0;
  // Continuous transition from flight to a slow fluttering fall, never snap down.
  const descent=-.24+.035*Math.sin(t.clock*5);
  t.vy+=(descent-t.vy)*(1-Math.exp(-dt*4));
 }
 // Substeps prevent the 3.5 m/s sheet tunnelling through thin walls.
 const steps=Math.max(1,Math.ceil(Math.hypot(t.vx,t.vy,t.vz)*dt/.045)),h=dt/steps;
 for(let i=0;i<steps;i++){
  const nx=t.x+t.vx*h,nz=t.z+t.vz*h;
  const xOK=nx>=bounds.minX+clearance&&nx<=bounds.maxX-clearance&&tissueRectClear(nx,t.z,colliders,clearance);
  if(xOK)t.x=nx;else{t.vx=-t.vx;t.heading=-t.heading;t.targetHeading=t.heading;t.bounces++;}
  const zOK=nz>=bounds.minZ+clearance&&nz<=bounds.maxZ-clearance&&tissueRectClear(t.x,nz,colliders,clearance);
  if(zOK)t.z=nz;else{t.vz=-t.vz;t.heading=Math.PI-t.heading;t.targetHeading=t.heading;t.bounces++;}
  t.y+=t.vy*h;
  if(t.y>TISSUE.ceilingY){t.y=2*TISSUE.ceilingY-t.y;t.vy=-Math.abs(t.vy);t.pitch=-Math.abs(t.pitch);t.targetPitch=t.pitch;t.bounces++;}
  if(t.location==="air"&&t.y<TISSUE.radius){t.y=2*TISSUE.radius-t.y;t.vy=Math.abs(t.vy);t.pitch=Math.abs(t.pitch);t.targetPitch=t.pitch;t.bounces++;}
  if(t.location==="falling"&&t.y<=TISSUE.floorY){t.y=TISSUE.floorY;t.location="floor";t.vx=t.vy=t.vz=0;break;}
 }
}
