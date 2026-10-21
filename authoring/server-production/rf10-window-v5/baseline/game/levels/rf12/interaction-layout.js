// One scene contract for all three RF-10 difficulties. Metres, Y up.
export const REVISION = "rf10-fire-v4";
export const KITCHEN = Object.freeze({
 oil: {x:-1.55,y:.902,z:-2.27,yaw:0},
 prep: {x:-2.55,y:.919,z:-2.3,yaw:0},
 kettle: {x:.15,y:.902,z:-2.30,yaw:0},
 fill: {x:-.45,y:.86,z:-2.38,yaw:0},
 faucet: {x:-.425,y:1.247,z:-2.38},
 pan: {x:1.15,y:.902,z:-2.43,yaw:0},
 burner: {x:2.25,y:1.025,z:-2.43,yaw:0},
 extinguisher: {x:-3.8,y:.24,z:.9,yaw:Math.PI/2},
 hood: {x:2.95,y:.96,z:-2.145},
 knob: {x:2.25,y:.99,z:-2.24},
 window: {x:-.95,y:.96,z:-2.145},
 terminal: {x:-3.35,y:1.03,z:2.28},
 cloth: {x:.65,y:.902,z:-2.27},
 sink: {x:-.45,y:.83,z:-2.38},
 valve: {x:3.83,y:.96,z:-2.3},
});
export const GRIPS = Object.freeze({
 kettle:[0,.24,.089], oil:[0,.20,0], pan:[0,.058,.25], extinguisher:[0,.49,0], cloth:[0,.03,0],
});
export const ITEM_FILES = Object.freeze({
 kettle:"../kettle-v3/kettle.glb", oil:"oil_bottle.glb",pan:"frying_pan.glb",extinguisher:"extinguisher.glb"
});
export function dropPoint(state,isWalkable) {
 for (const angle of [0,.6,-.6,1.2,-1.2,Math.PI]) {
  const yaw=state.player.yaw+angle,p={x:state.player.x+Math.sin(yaw)*.48,y:.006,z:state.player.z+Math.cos(yaw)*.48,yaw:state.player.yaw};
  if(isWalkable(state,p.x,p.z))return p;
 }
 return {...state.player,y:.006};
}
export function itemPose(state,item) {
 if(item==="oil") {const s=state.items?.oil;return s?.location==="floor"?s:s?.location==="prep"?KITCHEN.prep:KITCHEN.oil;}
 if(item==="kettle") {const k=state.kettle;return k?.location==="floor"?k:k?.location==="burner"?KITCHEN.burner:KITCHEN.kettle;}
 if(item==="pan") {const s=state.pan;return s?.location==="floor"?s:s?.location==="burner"?KITCHEN.burner:KITCHEN.pan;}
 if(item==="extinguisher")return state.extinguisher?.location==="floor"?state.extinguisher:KITCHEN.extinguisher;
 if(item==="cloth")return state.cloth?.location==="floor"?state.cloth:state.cloth?.location==="sink"?KITCHEN.sink:KITCHEN.cloth;
}
export function gripPoint(p,item) {
 const g=GRIPS[item],yaw=p.yaw??0;
 return {x:p.x+g[0]*Math.cos(yaw)+g[2]*Math.sin(yaw),y:(p.y??.006)+g[1],z:p.z-g[0]*Math.sin(yaw)+g[2]*Math.cos(yaw)};
}
