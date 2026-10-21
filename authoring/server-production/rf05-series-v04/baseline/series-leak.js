// Shared wet-room geometry and deterministic water parcels (not a fluid solver).
export const WETROOM = {
 floorY:.033, valve:{x:-2.66,y:1.10,z:5.07},
 source:{x:-2.25,y:1.92,z:4.90}, impact:{x:-2.34,z:4.62},
 drain:{x:-2.48,z:4.86,radius:.34},
 area:{minX:-3.02,maxX:-1.98,minZ:3.60,maxZ:4.99},
 toolHome:{x:-3.96,y:.04,z:2.85,yaw:Math.PI/2,tilt:0,roll:0},
 bladeWidth:.56,bladeDepth:.095,workingTilt:-.12,workingReach:.40,workingRoll:.16,
 rightGrip:.62,leftGrip:.78,leakRate:.15,maxAmount:1,dryThreshold:.025,
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createLeak(){
 return {clock:0,open:true,drained:0,cleared:false,parcels:Array.from({length:10},(_,i)=>({
  id:i,x:i%2?-2.24:-2.72,z:3.80+Math.floor(i/2)*.20,amount:.28+Math.floor(i/2)*.04
 }))};
}
export const waterAmount=leak=>leak.parcels.reduce((sum,p)=>sum+p.amount,0);
export function advanceLeak(leak,dt){
 leak.clock+=dt;
 if(leak.open){
  leak.cleared=false;
  for(const p of leak.parcels){
   if(p.amount<.002){p.x=p.id%2?-2.24:-2.72;p.z=3.80+Math.floor(p.id/2)*.20;}
   p.amount=Math.min(WETROOM.maxAmount,p.amount+dt*WETROOM.leakRate*(.6+Math.floor(p.id/2)*.1));
  }
 }
}
export function toolPose(state){
 if(!state.tool.held)return {...state.tool};
 const p=state.player;
 return {x:p.x+Math.sin(p.yaw)*WETROOM.workingReach,y:WETROOM.floorY+.012,z:p.z+Math.cos(p.yaw)*WETROOM.workingReach,yaw:p.yaw,tilt:WETROOM.workingTilt,roll:WETROOM.workingRoll};
}
export function toolGrip(pose,side){
 const h=side==="left"?WETROOM.leftGrip:WETROOM.rightGrip;
 const roll=pose.roll??0,localX=side==="left"?.009:-.009,dx=Math.cos(roll)*localX-Math.sin(roll)*h,hy=Math.sin(roll)*localX+Math.cos(roll)*h,dz=Math.sin(pose.tilt)*hy;
 return {x:pose.x+Math.cos(pose.yaw)*dx+Math.sin(pose.yaw)*dz,y:pose.y+Math.cos(pose.tilt)*hy,z:pose.z-Math.sin(pose.yaw)*dx+Math.cos(pose.yaw)*dz};
}
export function toolPoint(pose){
 const a=toolGrip(pose,"left"),b=toolGrip(pose,"right");return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2};
}
export function toolRect(pose,padding=0){
 const c=Math.abs(Math.cos(pose.yaw)),s=Math.abs(Math.sin(pose.yaw)),w=WETROOM.bladeWidth/2+padding,d=WETROOM.bladeDepth/2+padding;
 return {id:"squeegee",minX:pose.x-c*w-s*d,maxX:pose.x+c*w+s*d,minZ:pose.z-s*w-c*d,maxZ:pose.z+s*w+c*d};
}
export function sweepWater(leak,before,after){
 const dx=after.x-before.x,dz=after.z-before.z,travel=Math.hypot(dx,dz);
 const fx=Math.sin(after.yaw),fz=Math.cos(after.yaw);
 // The rubber blade pushes on forward strokes. Backing up/side-stepping repositions it.
 if(travel<1e-6||dx*fx+dz*fz<travel*.35)return;
 for(const p of leak.parcels){
  if(p.amount<=0)continue;
  const px=p.x-before.x,pz=p.z-before.z;
  const lateral=Math.cos(after.yaw)*px-Math.sin(after.yaw)*pz,forward=fx*px+fz*pz;
  if(Math.abs(lateral)>WETROOM.bladeWidth/2+.04||forward<-.13||forward>travel+.15)continue;
  const along=Math.max(.10,forward);
  p.x=clamp(after.x+Math.cos(after.yaw)*lateral+fx*along,WETROOM.area.minX,WETROOM.area.maxX);
  p.z=clamp(after.z-Math.sin(after.yaw)*lateral+fz*along,WETROOM.area.minZ,WETROOM.area.maxZ);
  if(Math.hypot(p.x-WETROOM.drain.x,p.z-WETROOM.drain.z)<WETROOM.drain.radius){
   leak.drained+=p.amount;p.amount=0;
  }
 }
 leak.cleared=!leak.open&&waterAmount(leak)<=WETROOM.dryThreshold&&leak.drained>0;
}
