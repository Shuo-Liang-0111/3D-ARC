import {LEVEL} from "./home-layout.js";
import {cloneState} from "./engine.js";
import {applyRobotMovement} from "../../movement.js";
export const SHELF=LEVEL.staticColliders.find(r=>r.id==="pesticide-shelf");
export function isWalkable(s,x,z){
 const radius=LEVEL.playerRadius,b=LEVEL.bounds;
 if(x-radius<b.minX||x+radius>b.maxX||z-radius<b.minZ||z+radius>b.maxZ)return false;
 return !LEVEL.staticColliders.some(r=>(x-Math.max(r.minX,Math.min(x,r.maxX)))**2+(z-Math.max(r.minZ,Math.min(z,r.maxZ)))**2<radius**2);
}
export function updateMovement(state,input,delta){
 const next=cloneState(state),dt=Math.min(.05,Math.max(0,delta));next.elapsed+=dt;if(state.complete||state.failed)return next;
 const movement=applyRobotMovement(next,state,input,dt,LEVEL,isWalkable);
 if(!movement.active){next.motion=state.carriedItem?"carrying":"idle";return next;}
 if(input.drain!==false)next.progress=Math.max(0,state.progress-LEVEL.progress.actionDrainPerSecond*dt);
 next.motion=movement.motionTurning?"turning":state.carriedItem?"carrying":"moving";
 if(next.progress<=0){next.failed=true;next.motion="idle";next.lastEvent="progress_depleted";}return next;
}
