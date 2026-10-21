import { WETROOM, toolPoint, toolPose, toolRect, waterAmount } from "./series-leak.js";
import { DIRTY, TARGETS, STOCK, SLOTS, EXIT, itemPose, standForFurniture } from "./series-layout.js";
export function installHotelQA(controller){
 const {options}=controller,r=options.runtime,panel=document.createElement("section");
 panel.id="rf05-qa";panel.style.cssText="position:fixed;left:15px;bottom:80px;z-index:1000;background:#15262dee;color:white;padding:12px;max-width:300px;font:12px monospace";
 const title=document.createElement("strong");title.textContent="RF-05 定点验收 · 仅布置机器人站位";panel.append(title);
 const status=document.createElement("pre");status.id="rf05-qa-status";status.style.cssText="white-space:pre-wrap;max-height:110px;overflow:auto";panel.append(status);
 panel.dataset.supports=JSON.stringify(controller.world.supportMetrics);
 const results=[];let active=false;const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const match=(a,b)=>a&&["type","item","target","slot","key"].every(k=>a[k]===b[k]);
 function pointFor(a,s){
  if(a.type==="pickup")return itemPose(a.item,s);
  if(a.type==="deliver")return a.target==="cart"?{x:s.furniture.cart.x,y:1.065,z:s.furniture.cart.z}:TARGETS[a.target];
  if(a.type==="restock")return SLOTS[a.slot];
  if(a.type==="valve")return WETROOM.valve;
  if(a.type==="tool-take")return toolPoint(s.tool);if(a.type==="tool-return")return toolPoint(WETROOM.toolHome);
  if(a.type==="exit")return EXIT;
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
   if(performance.now()-start>60000)throw Error("Animation did not finish");await sleep(180);}
 }
 async function action(a,teleport=true){
  if(teleport)station(a);await sleep(180);const s=options.getState();
  if(!match(r.getInteraction(s),a))throw Error("Wrong selected action "+JSON.stringify(r.getInteraction(s)));
  const n=s.interactions;controller.interact();await settle();
  if(["timeout","rejected"].includes(controller.lastResult?.type))throw Error("Animation failed: "+JSON.stringify(controller.lastResult));
  if(options.getState().interactions!==n+1)throw Error("No authoritative commit: "+JSON.stringify(controller.snapshot()));
  if(["wrong_target","slot_unavailable","room_incomplete","target_unavailable"].includes(options.getState().lastEvent))throw Error("Action rejected: "+options.getState().lastEvent);
  results.push({requested:a,contact:controller.lastResult,state:r.getDebugState(options.getState())});panel.dataset.results=JSON.stringify(results);
  status.textContent=JSON.stringify({result:"step passed",count:results.length,last:a});await sleep(250);
 }
 async function recover(){for(const item of ["towel","cup","trash"]){if(options.getState().delivered[item])continue;await action({type:"pickup",item});await action({type:"deliver",item,target:{towel:"laundry",cup:"cart",trash:"bin"}[item]});}}
 async function restock(){for(const item of Object.keys(STOCK)){if(options.getState().slots[item])continue;await action({type:"pickup",item});await action({type:"restock",item,slot:item});}}
 async function pulse(key,seconds){
  window.dispatchEvent(new KeyboardEvent("keydown",{code:key.startsWith("Arrow")?key:"Key"+key,bubbles:true}));
  try{await sleep(seconds*1000);}finally{window.dispatchEvent(new KeyboardEvent("keyup",{code:key.startsWith("Arrow")?key:"Key"+key,bubbles:true}));}
 }
 async function drive(x,z){
  const start=performance.now();
  while(Math.hypot(options.getState().player.x-x,options.getState().player.z-z)>.008){
   const p=options.getState().player,dx=x-p.x,dz=z-p.z,f=Math.sin(p.yaw)*dx+Math.cos(p.yaw)*dz,l=Math.cos(p.yaw)*dx-Math.sin(p.yaw)*dz;
   const forward=Math.abs(f)>Math.abs(l),key=forward?(f>0?"W":"S"):(l>0?"A":"D"),error=Math.abs(forward?f:l);
   if(performance.now()-start>18000)throw Error("Local squeegee movement blocked "+JSON.stringify({player:p,target:{x,z},event:options.getState().lastEvent}));
   await pulse(key,Math.min(.25,Math.max(.015,error/.42*.7)));
  }
 }
 async function turn(yaw){
  const start=performance.now();
  for(;;){const p=options.getState().player,d=Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw));if(Math.abs(d)<.018)return;
   if(performance.now()-start>16000)throw Error("Tool turning blocked");
   await pulse(d>0?"Q":"E",Math.min(.22,Math.max(.035,Math.abs(d)/.65*.7)));
  }
 }
 async function cleanLeak(){
  if(options.getState().leak.open)await action({type:"valve"});
  if(!options.getState().tool.held)await action({type:"tool-take"});
  await captureFrame("rf05-tool-grip-evidence");
  await drive(-2.90,2.85);await turn(-Math.PI);await drive(-2.90,3.40);
  await turn(-Math.PI*1.5);await turn(-Math.PI*2);await drive(-2.48,3.40);
  const before=waterAmount(options.getState().leak);await captureFrame("rf05-water-before");
  await drive(-2.48,3.98);await captureFrame("rf05-squeegee-action");
  await drive(-2.48,4.27);
  const after=waterAmount(options.getState().leak);
  if(after>WETROOM.dryThreshold||!options.getState().leak.cleared)throw Error("Water remains: "+JSON.stringify(options.getState().leak));
  results.push({squeegee:{before,after,drained:options.getState().leak.drained,gripError:controller.snapshot().gripError}});
  await captureFrame("rf05-water-after");
  await drive(-2.48,3.40);await drive(-2.90,3.40);await turn(Math.PI/2);await turn(Math.PI);
  await drive(-2.90,2.85);await turn(Math.PI*1.5);await drive(-3.35,2.85);
  await action({type:"tool-return"},false);
  if(options.getState().tool.held||!options.getState().tool.returned)throw Error("Tool did not return");
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
 button("验证刮水器墙碰撞",async()=>{
  await action({type:"tool-take"});
  const before={...options.getState().player};
  await pulse("W",.7);
  const stop={...options.getState().player},blade=toolRect(toolPose(options.getState()));
  if(blade.minX< -4.05-.001)throw Error("Blade crossed west wall");
  await pulse("S",.5);const retreat={...options.getState().player};
  if(retreat.x<=stop.x+.08)throw Error("Cannot retreat with tool");
  results.push({toolCollision:{before,stop,retreat,blade}});
  await action({type:"tool-return"},false);
 });
 button("验证持物墙碰撞",async()=>{
  if(!options.getState().carriedItem)await action({type:"pickup",item:"towel"});
  place({x:-3.25,z:0,yaw:-Math.PI/2});await pulse("W",1.3);
  if(options.getState().player.x < -3.52)throw Error("Payload crossed west wall");
  const stopX=options.getState().player.x;await pulse("S",1.2);await sleep(300);
  if(options.getState().player.x<=stopX)throw Error("Cannot retreat from wall");
  results.push({wallContact:{stopX,retreatX:options.getState().player.x}});
 });
 button("验证全任务",async()=>{await recover();if(r.LEVEL.id!=="rf05")await restock();if(r.LEVEL.id==="rf05-3"){await cleanLeak();await pushTo("chair");await pushTo("cart");await action({type:"exit"});}if(!options.getState().complete)throw Error("Final objective did not complete");});button("验证三件回收",recover);button("验证两套补给",restock);button("验证止漏刮水",cleanLeak);button("验证椅子归位",()=>pushTo("chair"));button("验证推车归位",()=>pushTo("cart"));
 for(const [name,a]of [["定位毛巾",{type:"pickup",item:"towel"}],["定位淋浴阀门",{type:"valve"}],["定位刮水器",{type:"tool-take"}],["定位推车",{type:"grip",key:"cart"}],["定位椅子",{type:"grip",key:"chair"}],["定位交房",{type:"exit"}]])button(name,()=>station(a));
 button("F 正式交互",()=>action(r.getInteraction(options.getState()),false));
 for(const key of ["W","S","A","D","Q","E"])button(key+" 0.5秒",async()=>{window.dispatchEvent(new KeyboardEvent("keydown",{code:key.startsWith("Arrow")?key:"Key"+key,bubbles:true}));await sleep(500);window.dispatchEvent(new KeyboardEvent("keyup",{code:key.startsWith("Arrow")?key:"Key"+key,bubbles:true}));});
 button("场景几何记录",()=>{status.textContent=JSON.stringify({supports:controller.world.supportMetrics,items:Object.fromEntries(Object.entries(controller.world.serviceItems).map(([id,m])=>[id,{visible:m.visible,pos:m.position.toArray()}]))},null,2);});
 button("低头查看",()=>pulse("ArrowDown",.6));
 button("抬头查看",()=>pulse("ArrowUp",.65));
 button("查看房顶",()=>place({x:0,z:.2,yaw:Math.PI}));
 button("观察积水",()=>place({x:-2.48,z:3.25,yaw:0}));
 button("验证关闭漏水",()=>action({type:"valve"}));
 button("验证取刮水器",()=>action({type:"tool-take"}));
 button("记录当前状态",()=>{status.textContent=JSON.stringify(controller.snapshot());});
 button("查看床头",()=>place({x:-1,z:-3.45,yaw:Math.PI}));
 button("查看床上毛巾",()=>place({x:-2.30,z:-1.72,yaw:Math.PI}));
 button("查看卫生间",()=>place({x:-2.60,z:3.15,yaw:.4}));
 button("验证床头取杯",async()=>{await action({type:"pickup",item:"cup"});await captureFrame("rf05-cup-evidence");await action({type:"deliver",item:"cup",target:"cart"});});
 button("验证毛巾取放",async()=>{
  await action({type:"pickup",item:"towel"});await action({type:"deliver",item:"towel",target:"laundry"});
  for(const item of ["towel1","towel2"]){await action({type:"pickup",item});await action({type:"restock",item,slot:item});}
 });
 button("验证椅子短推转向",async()=>{
  await action({type:"grip",key:"chair"});await sleep(400);await captureFrame("rf05-chair-evidence");
  const before=structuredClone(options.getState().furniture.chair);
  await pulse("W",.4);await pulse("Q",.4);await captureFrame("rf05-chair-turn-evidence");
  const after=structuredClone(options.getState().furniture.chair),grip=controller.snapshot().gripError;
  if(Math.hypot(after.x-before.x,after.z-before.z)<.06||Math.abs(after.yaw-before.yaw)<.1)throw Error("Chair did not move and turn");
  if(grip>.05)throw Error("Chair hand contact lost");
  await pulse("S",.4);await pulse("E",.4);await action({type:"release",key:"chair"},false);
  results.push({chairMovement:{before,after,grip}});
 });
 button("验证卫生间碰撞",async()=>{
  place({x:-2.65,z:3.65,yaw:Math.PI/2});await pulse("W",1.4);
  const stop=options.getState().player.x;if(stop> -2.22)throw Error("Crossed visible toilet");
  await pulse("S",1.6);await sleep(250);const retreat=options.getState().player.x;
  if(retreat>=stop)throw Error("Unable to retreat: "+JSON.stringify({stop,retreat,player:options.getState().player}));
  results.push({toiletCollision:{stop,retreat}});
 });

 button("导出当前画面",async()=>{
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  await captureFrame();
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
