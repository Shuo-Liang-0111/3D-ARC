import * as THREE from "three";
import {CAN,RULES,sprayHits} from "./engine.js";
export function installPestQA(c){
 const o=c.options,r=o.runtime,panel=document.createElement("section");panel.id="rf06-pest-qa";panel.style.cssText="position:fixed;left:16px;bottom:90px;z-index:9999;background:#15282ddd;color:white;padding:10px;font:12px monospace;max-width:340px";
 const status=document.createElement("pre");status.style.whiteSpace="pre-wrap";panel.append(status);
 const button=(text,fn)=>{const b=document.createElement("button");b.textContent=text;b.onclick=()=>Promise.resolve(fn()).catch(e=>panel.dataset.error=e.message);panel.append(b);return b;};
 function place(player){if(c.busy)throw Error("Cannot place during animation");const s=o.getState();if(!r.isWalkable(s,player.x,player.z))throw Error("Blocked station");o.stop();o.setState({...s,player:{...s.player,...player}});}
 function pickupStation(){const s=o.getState();for(const distance of [.7,.85,1.0])for(let i=0;i<64;i++){const yaw=i*Math.PI/32,p={x:CAN.x-Math.sin(yaw)*distance,z:CAN.z-Math.cos(yaw)*distance,yaw};if(r.isWalkable(s,p.x,p.z)){place(p);return;}}throw Error("No pickup station");}
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 async function settle(){const start=performance.now();while(c.busy){await delay(100);if(performance.now()-start>180000)throw Error("Animation timeout");}if(c.lastResult?.type==="timeout")throw Error(JSON.stringify(c.lastResult));}
 async function shootLive(){
  if(o.getState().carriedItem!=="spray")throw Error("Pick up spray first");
  for(let attempt=0;attempt<12;attempt++){
   const s=o.getState(),target=s.roaches.find(x=>x.alive);if(!target)return;
   let found=false;
   for(const distance of [1.5,1.3,1.65])for(let i=0;i<64;i++){
    const yaw=i*Math.PI/32,p={x:target.x-Math.sin(yaw)*distance+Math.cos(yaw)*.16,z:target.z-Math.cos(yaw)*distance-Math.sin(yaw)*.16,yaw};
    if(!r.isWalkable(s,p.x,p.z))continue;
    const origin={x:p.x+Math.sin(yaw)*.45-Math.cos(yaw)*.16,y:.97,z:p.z+Math.cos(yaw)*.45+Math.sin(yaw)*.16},direction={x:Math.sin(yaw)*Math.cos(.65),y:-Math.sin(.65),z:Math.cos(yaw)*Math.cos(.65)};
    if(!sprayHits(origin,direction,target))continue;place(p);found=true;break;
   }
   if(!found){await delay(200);continue;}
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const before=o.getState().kills;c.interact();await delay(460);
   if(o.getState().kills>before)return;
  }
  throw Error("No live hit in bounded QA attempts");
 }
 button("QA 拾取杀虫剂",async()=>{pickupStation();c.interact();await settle();});
 button("QA 短喷",()=>c.interact());
 button("QA 定点喷杀一只",shootLive);
 button("QA 隐藏面板",()=>panel.style.display="none");
 const auto=button("QA 自动动作验收",async()=>{
  auto.disabled=true;panel.dataset.run="running";
  try{pickupStation();c.interact();await settle();await shootLive();await shootLive();await delay(500);panel.dataset.run=o.getState().complete?"passed":"failed";}catch(e){panel.dataset.run="failed";panel.dataset.error=e.message;}finally{auto.disabled=false;}
 });
 button("QA 第一视角站位",()=>place({x:3.95,z:-1.1,yaw:0}));
 setInterval(()=>{
  const s=o.getState(),snap=c.snapshot();
  panel.dataset.state=JSON.stringify(s);panel.dataset.snapshot=JSON.stringify(snap);
  panel.dataset.nozzle=JSON.stringify(s.carriedItem?c.nozzle():null);
  panel.dataset.ceiling=String(c.world.ceiling.visible);
  status.textContent=JSON.stringify({phase:snap.phase,fps:snap.fps?.toFixed(1),shots:s.shots,kills:s.kills,can:s.canLocation,last:snap.lastResult});
 },250);
 document.body.append(panel);
 window.__RF06_PEST_QA__={place,pickupStation,shootLive,state:()=>structuredClone(o.getState()),snapshot:()=>c.snapshot(),world:()=>c.world,robot:()=>c.robot,controller:c,runtime:r};
}
