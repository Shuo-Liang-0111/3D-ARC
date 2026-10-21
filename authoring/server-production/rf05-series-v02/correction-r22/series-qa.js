import { DIRTY, TARGETS, STOCK, SLOTS, BASIN, EXIT, itemPose, standForFurniture } from "./series-layout.js";
export function installHotelQA(controller){
 const {options}=controller,r=options.runtime,panel=document.createElement("section");
 panel.id="rf05-qa";panel.style.cssText="position:fixed;left:15px;bottom:80px;z-index:1000;background:#15262dee;color:white;padding:12px;max-width:300px;font:12px monospace";
 const title=document.createElement("strong");title.textContent="RF-05 定点验收 · 仅布置机器人站位";panel.append(title);
 const status=document.createElement("pre");status.id="rf05-qa-status";status.style.cssText="white-space:pre-wrap;max-height:110px;overflow:auto";panel.append(status);
 panel.dataset.supports=JSON.stringify(controller.world.supportMetrics);
 const results=[];let active=false;const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const match=(a,b)=>a&&["type","item","target","slot","key"].every(k=>a[k]===b[k]);
 function pointFor(a,s){
  if(a.type==="pickup"||a.type==="sink-take")return itemPose(a.item,s);
  if(a.type==="deliver")return a.target==="cart"?{x:s.furniture.cart.x,y:1.065,z:s.furniture.cart.z}:TARGETS[a.target];
  if(a.type==="restock")return SLOTS[a.slot];
  if(a.type==="tap")return BASIN.tap;if(a.type==="drain")return BASIN.drain;
  if(a.type==="sink-place"||a.type==="wash")return BASIN.cup;if(a.type==="exit")return EXIT;
  if(a.type==="grip"||a.type==="release")return standForFurniture(s.furniture[a.key]);
 }
 function place(player){
  if(controller.busy)throw Error("Cannot teleport during action/attachment");
  const s=options.getState();if(!r.isWalkable(s,player.x,player.z))throw Error("Invalid test station");
  options.stop();options.setState({...s,player:{...s.player,...player}});
 }
 function station(a){
  const s=options.getState(),p=pointFor(a,s);if(!p)throw Error("Missing point");
  const stations=a.type==="grip"?[standForFurniture(s.furniture[a.key])]:[];
  for(const radius of [.7,.8,.9,1.05,.60])for(let i=0;i<64;i++){
   const yaw=i*Math.PI/32;stations.push({x:p.x-Math.sin(yaw)*radius,z:p.z-Math.cos(yaw)*radius,yaw});
  }
  for(const player of stations)if(r.isWalkable(s,player.x,player.z)&&match(r.getInteraction({...s,player}),a)){place(player);return player;}
  throw Error("No collision-safe selectable station: "+JSON.stringify(a));
 }
 async function captureFrame(id="rf05-evidence-image"){
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const canvas=document.querySelector("#game-shell canvas"),image=document.createElement("img");
  image.id=id;image.alt="RF05 official game WebGL frame "+new Date().toISOString();image.src=canvas.toDataURL("image/png");
  image.style.cssText="position:fixed;left:8px;top:8px;width:240px;z-index:2000;border:1px solid white";
  document.getElementById(id)?.remove();document.body.append(image);
 }
 async function settle(){
  const start=performance.now();while(controller.action){status.textContent=JSON.stringify({phase:controller.snapshot().phase,error:controller.snapshot().error,action:controller.action?.selected.type,time:Math.round((performance.now()-start)/1000),done:results.length,lastResult:controller.lastResult},null,2);
   if(controller.action?.phase==="wash"&&controller.action.time>1&&!controller.action.qaCaptured){controller.action.qaCaptured=true;captureFrame("rf05-washing-evidence");}
   if(performance.now()-start>60000)throw Error("Animation did not finish");await sleep(180);}
 }
 async function action(a,teleport=true){
  if(teleport)station(a);await sleep(180);const s=options.getState();
  if(!match(r.getInteraction(s),a))throw Error("Wrong selected action "+JSON.stringify(r.getInteraction(s)));
  const n=s.interactions;controller.interact();await settle();
  if(["timeout","rejected"].includes(controller.lastResult?.type))throw Error("Animation failed: "+JSON.stringify(controller.lastResult));
  if(options.getState().interactions!==n+1)throw Error("No authoritative commit: "+JSON.stringify(controller.snapshot()));
  if(["wrong_target","slot_unavailable","water_unsuitable","room_incomplete","target_unavailable"].includes(options.getState().lastEvent))throw Error("Action rejected: "+options.getState().lastEvent);
  results.push({requested:a,contact:controller.lastResult,state:r.getDebugState(options.getState())});panel.dataset.results=JSON.stringify(results);
  status.textContent=JSON.stringify({result:"step passed",count:results.length,last:a});await sleep(250);
 }
 async function recover(){for(const item of ["towel","cup","trash"]){if(options.getState().delivered[item])continue;await action({type:"pickup",item});await action({type:"deliver",item,target:{towel:"laundry",cup:"cart",trash:"bin"}[item]});}}
 async function restock(){for(const item of Object.keys(STOCK)){if(options.getState().slots[item])continue;await action({type:"pickup",item});await action({type:"restock",item,slot:item});}}
 async function wash(){
  if(options.getState().items.cup.location!=="sink"){await action({type:"pickup",item:"cup"});await action({type:"sink-place",item:"cup"});}
  await action({type:"tap"});while(options.getState().sink.water<.41){status.textContent=JSON.stringify({phase:"water rising",water:options.getState().sink.water});await sleep(180);}
  await action({type:"tap"});await action({type:"wash"});await action({type:"drain"});
  while(options.getState().sink.water>.001)await sleep(180);
  await action({type:"sink-take",item:"cup"});await action({type:"deliver",item:"cup",target:"cart"});
 }
 async function pulse(key,seconds){
  window.dispatchEvent(new KeyboardEvent("keydown",{code:key.startsWith("Arrow")?key:"Key"+key,bubbles:true}));
  try{await sleep(seconds*1000);}finally{window.dispatchEvent(new KeyboardEvent("keyup",{code:key.startsWith("Arrow")?key:"Key"+key,bubbles:true}));}
 }
 async function pushTo(key){
  await action({type:"grip",key});
  const start=performance.now();
  while(!r.parked(options.getState().furniture[key])){
   const f=options.getState().furniture[key],dx=f.target.x-f.x,dz=f.target.z-f.z;
   const forward=Math.sin(f.yaw)*dx+Math.cos(f.yaw)*dz,lateral=Math.cos(f.yaw)*dx-Math.sin(f.yaw)*dz;
   if(performance.now()-start>25000)throw Error("Local furniture push blocked");
   const control=Math.abs(lateral)>.08?(lateral>0?"A":"D"):(forward>0?"W":"S");
   await pulse(control,Math.min(.35,Math.max(.1,Math.abs(Math.abs(lateral)>.08?lateral:forward)*1.8)));
   status.textContent=JSON.stringify({phase:"manual-input local push",key,position:options.getState().furniture[key]});
  }
  await action({type:"release",key},false);
 }
 function button(text,fn){const b=document.createElement("button");b.textContent=text;b.style.cssText="margin:4px;padding:5px";b.onclick=async()=>{if(active)return;active=true;try{await fn();status.textContent=JSON.stringify({result:"PASSED",count:results.length,complete:options.getState().complete,last:controller.lastResult});}catch(e){status.textContent="FAILED: "+e.message;}finally{active=false;panel.dataset.results=JSON.stringify(results);}};panel.append(b);}
 button("验证持物墙碰撞",async()=>{
  if(!options.getState().carriedItem)await action({type:"pickup",item:"towel"});
  place({x:-3.25,z:0,yaw:-Math.PI/2});await pulse("W",1.3);
  if(options.getState().player.x < -3.52)throw Error("Payload crossed west wall");
  const stopX=options.getState().player.x;await pulse("S",1.2);await sleep(300);
  if(options.getState().player.x<=stopX)throw Error("Cannot retreat from wall");
  results.push({wallContact:{stopX,retreatX:options.getState().player.x}});
 });
 button("验证全任务",async()=>{await recover();if(r.LEVEL.id!=="rf05")await restock();if(r.LEVEL.id==="rf05-3"){await wash();await pushTo("chair");await pushTo("cart");await action({type:"exit"});}if(!options.getState().complete)throw Error("Final objective did not complete");});button("验证三件回收",recover);button("验证两套补给",restock);button("验证动态清洗",wash);button("验证椅子归位",()=>pushTo("chair"));button("验证推车归位",()=>pushTo("cart"));
 for(const [name,a]of [["定位毛巾",{type:"pickup",item:"towel"}],["定位水龙头",{type:"tap"}],["定位洗杯",{type:"wash"}],["定位排水",{type:"drain"}],["定位推车",{type:"grip",key:"cart"}],["定位椅子",{type:"grip",key:"chair"}],["定位交房",{type:"exit"}]])button(name,()=>station(a));
 button("F 正式交互",()=>action(r.getInteraction(options.getState()),false));
 for(const key of ["W","S","A","D","Q","E"])button(key+" 0.5秒",async()=>{window.dispatchEvent(new KeyboardEvent("keydown",{code:key.startsWith("Arrow")?key:"Key"+key,bubbles:true}));await sleep(500);window.dispatchEvent(new KeyboardEvent("keyup",{code:key.startsWith("Arrow")?key:"Key"+key,bubbles:true}));});
 button("场景几何记录",()=>{status.textContent=JSON.stringify({supports:controller.world.supportMetrics,items:Object.fromEntries(Object.entries(controller.world.serviceItems).map(([id,m])=>[id,{visible:m.visible,pos:m.position.toArray()}]))},null,2);});
 button("低头查看",()=>pulse("ArrowDown",.6));
 button("导出当前画面",async()=>{
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  captureFrame();
 });
 button("采样帧率10秒",async()=>{
  const samples=[];for(let i=0;i<20;i++){await sleep(500);samples.push(controller.snapshot().fps);}
  const report={viewport:[innerWidth,innerHeight],canvas:[document.querySelector("#game-shell canvas").width,document.querySelector("#game-shell canvas").height],samples,min:Math.min(...samples),mean:samples.reduce((a,b)=>a+b,0)/samples.length};
  panel.dataset.performance=JSON.stringify(report);results.push({performance:report});
 });
 button("隐藏验收面板",()=>{panel.style.display="none";});
 document.body.append(panel);
 controller.qa={place,station,results,state:()=>structuredClone(options.getState())};
}
