// Window animation is shared by all three variants; beds remain untouched.
export const WINDOW_CLOSE_DURATION=1.6;
export const WINDOW={hingeX:3.48,z:-5.04,handleX:-.86,handleY:1.02,handleZ:.065,maxAngle:.40};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function windowPoint(b){const a=b.opening*WINDOW.maxAngle;return {x:WINDOW.hingeX+WINDOW.handleX*Math.cos(a)+WINDOW.handleZ*Math.sin(a),y:WINDOW.handleY,z:WINDOW.z-WINDOW.handleX*Math.sin(a)+WINDOW.handleZ*Math.cos(a)};}
export function createWind(open=true){return {clock:0,opening:open?1:0,latch:open?0:1,latched:!open,wind:open?1:0};}
export function advanceWind(w,dt){w.clock+=dt;const target=w.latched?0:Math.max(.18,w.opening);w.wind+=(target-w.wind)*(1-Math.exp(-dt*1.7));}
export function taskPoint(s){return windowPoint(s.wind);}
export function animateWindow(w,progress,from){const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>v*v*(3-2*v),u=clamp(progress);w.opening=from.opening*(1-ease(clamp(u/.78)));w.latch=ease(clamp((u-.78)/.22));}
