export function installQA(c){
 const o=c.options,r=o.runtime,LEVEL=r.LEVEL;
 const place=p=>{if(c.busy)throw Error("Cannot place during animation");const s=o.getState();if(!r.isWalkable(s,p.x,p.z))throw Error("Blocked station");o.stop();o.setState({...s,player:{...s.player,...p}});};
 const match=(a,b)=>a&&a.type===b.type&&(!b.item||a.item===b.item);
 const station=a=>{
  const s=o.getState(),p=a.type==="pickup"?s.items[a.item]:a.type==="valve"?LEVEL.valve:a.type==="return"?LEVEL.items[a.item]:a.type==="bucket-place"?LEVEL.bucketDrop:LEVEL.puddle;
  for(const radius of [.7,.9,1.05,.5])for(let i=0;i<64;i++){const yaw=i*Math.PI/32,player={x:p.x-Math.sin(yaw)*radius,z:p.z-Math.cos(yaw)*radius,yaw};if(r.isWalkable(s,player.x,player.z)&&match(r.getInteraction({...s,player}),a)){place(player);return player;}}
  throw Error("No station "+JSON.stringify(a));
 };
 const panel=document.createElement("div");panel.id="rf06-qa";panel.style.cssText="position:fixed;bottom:100px;left:20px;z-index:9999;background:#122a30;color:white;padding:8px;max-width:320px;font:12px monospace";
 const status=document.createElement("pre");status.style.whiteSpace="pre-wrap";panel.append(status);
 const actions=[{type:"pickup",item:"wrench"},{type:"valve"},{type:"return",item:"wrench"},{type:"pickup",item:"bucket"},{type:"bucket-place"},{type:"pickup",item:"mop"},{type:"mop"},{type:"drop"},{type:"return",item:"mop"}];
 for(const a of actions){const b=document.createElement("button");b.textContent="QA "+a.type+" "+(a.item??"");b.onclick=()=>{try{if(a.type!=="drop")station(a);c.interact();}catch(e){status.textContent=e.message;}};panel.append(b);}
 const timer=setInterval(()=>{panel.dataset.snapshot=JSON.stringify(c.snapshot());panel.dataset.state=JSON.stringify(o.getState());status.textContent=JSON.stringify({phase:c.snapshot().phase,error:c.snapshot().error,water:o.getState().water,last:c.lastResult,wet:c.world.wet.visible,radius:c.world.wetUniform.value});},500);
 const auto=document.createElement("button");auto.textContent="QA RUN ACTION CHECKS";panel.append(auto);
 const delay=ms=>new Promise(r=>setTimeout(r,ms));
 const runAction=async a=>{
  if(a.type!=="drop")station(a);c.interact();
  const start=performance.now();while(c.busy){await delay(100);if(performance.now()-start>180000)throw Error("QA action timeout");}
  if(c.lastResult?.type==="timeout")throw Error(JSON.stringify(c.lastResult));await delay(100);
 };
 auto.onclick=async()=>{
  auto.disabled=true;const results=[];panel.dataset.run="running";
  try{
   c.reset();o.setState(r.createInitialState());
   for(const a of [{type:"pickup",item:"wrench"},{type:"valve"},{type:"return",item:"wrench"},{type:"pickup",item:"bucket"},{type:"bucket-place"},{type:"pickup",item:"mop"}]){await runAction(a);results.push(c.lastResult);}
   while(o.getState().water>.001){
    await runAction({type:"mop"});results.push(c.lastResult);
   }
   await runAction({type:"return",item:"mop"});
   panel.dataset.run=o.getState().complete?"passed":"failed-incomplete";
  }catch(e){panel.dataset.run="failed";panel.dataset.failure=e.message;}
  panel.dataset.results=JSON.stringify(results);auto.disabled=false;
 };
 for(const [label,p]of [["QA 厨房观察",{x:-2.95,z:1.45,yaw:0}],["QA 门口观察",{x:-.7,z:1.75,yaw:-Math.PI/2}],["QA 客厅观察",{x:1.9,z:.35,yaw:-Math.PI/2}]]){
 const b=document.createElement("button");b.textContent=label;b.onclick=()=>place(p);panel.append(b);
}
const flood=document.createElement("button");flood.textContent="QA 模拟漏水 180 秒";flood.onclick=()=>{let s=o.getState();for(let i=0;i<3600;i++)s=r.updateEnvironment(s,.05);o.setState(s);panel.dataset.simulatedSeconds="180";};panel.append(flood);
document.body.append(panel);
 window.__RF06_QA__={place,station,state:()=>structuredClone(o.getState()),snapshot:()=>c.snapshot(),world:()=>c.world,robot:()=>c.robot,interact:()=>c.interact(),reset:()=>{c.reset();o.setState(r.createInitialState());},runtime:r};
}
