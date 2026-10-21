import { PORTALS } from "./architecture-layout.js";
import {wallDistance,vacuumInside} from "./vacuum-navigation.js";
import * as THREE from "three";
import { BAYS,DOCK,DRY_SECONDS,dist,clearCircle } from "./series-layout.js";
export function installLaundryQA(controller){
 const {options}=controller,r=options.runtime;
 const panel=document.createElement("section");panel.id="rf04-qa-panel";panel.style.cssText="position:fixed;left:20px;bottom:85px;z-index:1000;background:#13252beF;color:white;padding:12px;max-width:530px;font:13px monospace";
 const title=document.createElement("strong");title.textContent="RF-04 定点验收 · 仅瞬移机器人站位";panel.append(title,document.createElement("br"));
 const status=document.createElement("pre");status.id="rf04-qa-status";status.style.cssText="max-height:130px;overflow:auto;white-space:pre-wrap";status.textContent="READY";panel.append(status);
 const results=[];let active=false;
 const frames=[];let previous=performance.now();
 function tick(now){if(document.visibilityState==="visible"){frames.push(now-previous);if(frames.length>300)frames.shift();}previous=now;panel.dataset.performance=JSON.stringify({frames:frames.length,fps:frames.length?1000*frames.length/frames.reduce((a,b)=>a+b,0):0});requestAnimationFrame(tick);}requestAnimationFrame(tick);

 const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function match(a,b){return a?.type===b.type&&a?.clothingType===b.clothingType&&a?.bay===b.bay;}
 function station(selected){
  const state=options.getState(),p=r.pointFor(state,selected);
  for(const radius of [.68,.78,.60])for(let i=0;i<32;i++){
   const yaw=i*Math.PI/16,player={x:p.x-Math.sin(yaw)*radius,z:p.z-Math.cos(yaw)*radius,yaw};
   const s={...state,player};
   if((!s.carriedItem||clearCircle(player.x,player.z,.60))&&r.isWalkable(s,player.x,player.z)&&match(r.getInteraction(s),selected)){window.__RF04_QA__.place(player);return;}
  }
  throw Error("No station "+JSON.stringify(selected));
 }
 async function settle(){
  const start=performance.now();
  while(controller.busy){status.textContent=JSON.stringify({phase:controller.snapshot().phase,action:controller.action?.selected.type,seconds:Math.round((performance.now()-start)/1000),done:results.length,lastResult:controller.lastResult},null,2);if(performance.now()-start>130000)throw Error("Animation timeout");await sleep(180);}
 }
 async function action(selected){
  station(selected);await sleep(180);
  if(!match(r.getInteraction(options.getState()),selected))throw Error("Target moved before F");
  const before=options.getState().interactions;
  const stages=[];
  const capture=()=>({animation:controller.snapshot(),state:r.getDebugState(options.getState())});
  stages.push(capture());controller.interact();stages.push(capture());
  const sampling=setInterval(()=>stages.push(capture()),180);
  try{await settle();}finally{clearInterval(sampling);}
  stages.push(capture());
  if(selected.type==="vacuum"){
   const stopped=stages[1];
   if(stopped.state.vacuum.mode!=="stopped"||stopped.state.carriedItem||stopped.animation.crouch!==0)throw Error("F must stop before crouch/pickup");
   const waiting=stages.slice(1).filter(v=>!v.state.carriedItem);
   if(!waiting.some(v=>v.animation.crouch>.9)||waiting.some(v=>v.state.vacuum.x!==stopped.state.vacuum.x||v.state.vacuum.z!==stopped.state.vacuum.z))throw Error("Vacuum moved during crouch");
  }
  if(options.getState().interactions!==before+1)throw Error("Interaction did not commit: "+JSON.stringify(controller.snapshot()));
  const result={action:selected,stages,contact:controller.lastResult,state:r.getDebugState(options.getState())};
  results.push(result);status.textContent=JSON.stringify({result:"passed",actions:results.length,last:selected});
  await sleep(350);
 }
 async function laundry(){
  for(const type of ["shirt","pants","towel"]){await action({type:"clothing",clothingType:type});await action({type:"washer-load",clothingType:type});}
  await action({type:"washer-start"});
  while(options.getState().washerPhase==="washing")await sleep(200);
  await action({type:"washer-unload"});await action({type:"drying-rack"});
  if(r.LEVEL.advanced){while(options.getState().dryElapsed<DRY_SECONDS)await sleep(200);
   for(const t of ["shirt","pants","towel"]){await action({type:"dry-clothing",clothingType:t});await action({type:"store",bay:t,clothingType:t});}}
 }
 async function vacuum(){await action({type:"vacuum"});await action({type:"dock"});}
 function button(name,fn){const b=document.createElement("button");b.textContent=name;b.style.cssText="margin:5px;padding:5px";b.onclick=async()=>{if(active)return;active=true;try{await fn();status.textContent=JSON.stringify({result:"PASSED",count:results.length,complete:options.getState().complete,lastResult:controller.lastResult});}catch(e){status.textContent="FAILED: "+e.message;}finally{active=false;panel.dataset.results=JSON.stringify(results);}};panel.append(b);}
 button("验证取衣后移动",async()=>{
  // Explicit starting fixture: washer already finished, no pickup/motion result injected.
  const fixture=r.createInitialState();fixture.washerPhase="done";fixture.washElapsed=r.LEVEL.washDuration;
  for(const c of Object.values(fixture.clothes))c.location="washer";
  options.setState(fixture);controller.reset();
  await action({type:"washer-unload"});
  const start=structuredClone(options.getState().player),checks=[];
  if(!r.isWalkable(options.getState(),start.x,start.z))throw Error("Pickup left payload overlapping washer");
  for(const input of [{move:-1},{strafe:1},{strafe:-1},{turn:1},{turn:-1}]){
   const s=options.getState(),n=r.updateMovement(s,{...input,drain:false},1/144);
   if(Math.hypot(n.player.x-s.player.x,n.player.z-s.player.z)+Math.abs(n.player.yaw-s.player.yaw)<1e-6)throw Error("Movement locked after pickup");
   checks.push({input,start:s.player,end:n.player});options.setState(n);await sleep(100);
  }
  for(let i=0;i<45;i++){options.setState(r.updateMovement(options.getState(),{move:-.5,drain:false},.016));await sleep(16);}
  const end=options.getState().player;if(dist(start,end)<.4)throw Error("Could not back away from washer");
  panel.dataset.unload=JSON.stringify({start,end,checks,animation:controller.snapshot()});
 });
 button("验证洗衣收纳",laundry);if(r.LEVEL.dynamic){
  button("验证沿墙巡游",async()=>{
   const samples=[];
   for(let i=0;i<80;i++){const v=structuredClone(options.getState().vacuum);samples.push({...v,wallDistance:wallDistance(v)});if(!vacuumInside(v)||!clearCircle(v.x,v.z,.175))throw Error("Vacuum left safe indoor floor");status.textContent="沿墙巡游采样 "+(i+1)+"/80";await sleep(250);}
   panel.dataset.patrol=JSON.stringify(samples);
   if(samples.every(v=>Math.hypot(v.x-samples[0].x,v.z-samples[0].z)<.2))throw Error("Vacuum did not move");
  });
  button("验证抓取归位",vacuum);
  button("验证单次抓取",()=>action({type:"vacuum"}));
  button("验证单次归位",()=>action({type:"dock"}));
 }
 button("近景诊断",()=>{
  const robot=controller.robot,scene=controller.world.scene;
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1000,800);renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const camera=new THREE.PerspectiveCamera(45,1.25,.02,100);
  const offset=new THREE.Vector3(.95,1.65,1.75).applyAxisAngle(new THREE.Vector3(0,1,0),options.getState().player.yaw);
  camera.position.copy(robot.position).add(offset);camera.lookAt(robot.position.clone().add(new THREE.Vector3(0,.65,0)));renderer.render(scene,camera);
  let img=document.querySelector("#rf04-diagnostic");
  if(!img){img=document.createElement("img");img.id="rf04-diagnostic";img.alt="同一场景和动画的接触近景诊断";img.style.cssText="position:fixed;left:280px;top:0;width:800px;height:640px;z-index:1100";img.onclick=()=>img.remove();document.body.append(img);}
  img.src=renderer.domElement.toDataURL("image/png");renderer.dispose();
 });
 button("验证局部碰撞",async()=>{
  const saved=options.getState().player,checks=[];
  for(const fixture of [{name:"wall",x:-8.72,z:5.7,yaw:-Math.PI/2},{name:"storage",x:-1.95,z:5.70,yaw:0},{name:"west-bedroom",x:-5.0,z:5.15,yaw:Math.PI},{name:"bathroom",x:1.35,z:-.54,yaw:-Math.PI/2},{name:"east-bedroom",x:1.9,z:3.175,yaw:Math.PI/2},{name:"dining-hall",x:2.675,z:-.9,yaw:Math.PI},{name:"laundry-dining",x:3,z:-3,yaw:Math.PI/2}]){
   window.__RF04_QA__.place(fixture);const start={...options.getState().player};
   for(let i=0;i<55;i++){const n=r.updateMovement(options.getState(),{move:.5,turn:0,strafe:0,drain:false},.05);options.setState(n);await sleep(25);}
   const end=options.getState().player;checks.push({fixture:fixture.name,start,end,blocked:["wall","storage"].includes(fixture.name)?dist(start,end)<.6:dist(start,end)>1.2});
  }
  panel.dataset.collision=JSON.stringify(checks);
  if(!checks.every(c=>c.blocked))throw Error(JSON.stringify(checks));
  window.__RF04_QA__.place(saved);
 });
 let doorIndex=0;
 button("检查下一个门框",()=>{
  const p=PORTALS[Math.floor(doorIndex/2)%PORTALS.length],side=doorIndex%2?1:-1,alongX=p.w>p.d;doorIndex++;
  window.__RF04_QA__.place({x:p.x+(alongX?0:side*.9),z:p.z+(alongX?side*.9:0),yaw:alongX?(side<0?0:Math.PI):(side<0?Math.PI/2:-Math.PI/2)});
  panel.dataset.door=p.id+" / side "+side;
 });
 button("门框斜视",()=>{
  const index=Math.max(0,doorIndex-1),p=PORTALS[Math.floor(index/2)%PORTALS.length],side=index%2?1:-1,alongX=p.w>p.d;
  const x=p.x+(alongX?.38:side*1.25),z=p.z+(alongX?side*1.25:.38);
  window.__RF04_QA__.place({x,z,yaw:Math.atan2(p.x-x,p.z-z)});
 });
 button("定位上衣",()=>station({type:"clothing",clothingType:"shirt"}));
 if(r.LEVEL.dynamic)button("定位扫地机器人",()=>station({type:"vacuum"}));
 button("定位收纳区",()=>window.__RF04_QA__.place({x:-1.95,z:5.7,yaw:0}));
 button("保存当前画面",()=>{
  let img=document.querySelector("#rf04-evidence-frame");
  if(!img){img=document.createElement("img");img.id="rf04-evidence-frame";img.alt="RF04 formal gameplay capture";img.style.cssText="position:fixed;right:20px;bottom:12px;width:240px;z-index:1200";document.body.append(img);}
  img.src=window.__RELAY_DEMO__.captureFrame();
 });
 button("隐藏验收面板",()=>{panel.style.display="none";});
 document.body.append(panel);
 controller.qaResults=results;
}
