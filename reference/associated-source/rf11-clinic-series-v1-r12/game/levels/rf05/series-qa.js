import { TISSUE_IDS, distance3 } from "./series-tissues.js";
import { taskPoint } from "./series-wind.js";
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
  if(a.type==="window-close")return taskPoint(s,a);
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
  image.style.cssText="position:fixed;left:8px;top:8px;width:240px;pointer-events:none;z-index:2000;border:1px solid white";
  document.getElementById(id)?.remove();document.body.append(image);
 }
 async function settle(){
  const start=performance.now();while(controller.action){status.textContent=JSON.stringify({phase:controller.snapshot().phase,error:controller.snapshot().error,action:controller.action?.selected.type,time:Math.round((performance.now()-start)/1000),done:results.length,lastResult:controller.lastResult},null,2);
   if(controller.action?.phase==="lift"&&controller.action.selected.type==="pickup"&&controller.action.selected.item in STOCK&&!controller.action.stockEvidence){
    controller.action.stockEvidence=true;await captureFrame("rf05-"+controller.action.selected.item+"-contact");
   }
   if(controller.action?.phase==="lift"&&controller.action.selected.type==="tissue-catch"&&!controller.action.catchEvidence){controller.action.catchEvidence=true;await captureFrame("rf05-tissue-air-contact");}
   if(controller.action?.phase==="task-motion"&&controller.action.taskProgress>.4&&!controller.action.evidenceCaptured){
    controller.action.evidenceCaptured=true;await captureFrame("rf05-"+controller.action.selected.type+"-contact");
   }
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
 async function catchAir(){
  if(options.getState().wind.latched)throw Error("Use a fresh run with an open window");
  for(let attempt=0;attempt<18;attempt++){
   let predicted=structuredClone(options.getState()),fixture=null;
   for(let step=1;step<=70&&!fixture;step++){
    predicted=r.updateEnvironment(predicted,.025);
    if(step<28)continue;
    for(const id of TISSUE_IDS){
     const t=predicted.items[id];if(t.location!=="air"||t.y<.84||t.y>1.07)continue;
     for(const yaw of [t.heading+Math.PI,t.heading+Math.PI/2,t.heading-Math.PI/2]){
      const player={x:t.x-Math.sin(yaw)*.32+Math.cos(yaw)*.15,z:t.z-Math.cos(yaw)*.32-Math.sin(yaw)*.15,yaw};
      if(r.isWalkable(options.getState(),player.x,player.z,.65)){fixture={player,at:predicted.wind.clock,id};break;}
     }if(fixture)break;
    }
   }
   if(!fixture){await sleep(250);continue;}
   place(fixture.player);
   while(options.getState().wind.clock<fixture.at+.45){
    const s=options.getState(),a=r.getInteraction(s);
    if(a?.type==="tissue-catch"){
     const before=structuredClone(s.items[a.item]),hand={...s.catchHand},player={...s.player},n=s.interactions;
     controller.interact();await settle();
     if(options.getState().carriedItem!==a.item)throw Error("Air catch failed: "+JSON.stringify(controller.lastResult));
     if(options.getState().interactions!==n+1)throw Error("Air catch did not commit exactly once");
     await captureFrame("rf05-tissue-held");
     results.push({airCatch:{id:a.item,range:distance3(before,hand),before,hand,player,afterPlayer:options.getState().player,contact:controller.lastResult,attempt}});
     await action({type:"deliver",item:a.item,target:"bin"});
     return;
    }
    await new Promise(resolve=>requestAnimationFrame(resolve));
   }
  }
  throw Error("No natural flight entered the hand volume in the bounded interception trials");
 }
 async function collectTissues(){
  if(!options.getState().wind.latched)await action({type:"window-close"});
  const start=performance.now(),fallStart=structuredClone(TISSUE_IDS.map(id=>options.getState().items[id]));
  while(TISSUE_IDS.some(id=>["air","falling"].includes(options.getState().items[id].location))){
   if(performance.now()-start>20000)throw Error("Tissues did not settle");await sleep(200);
  }
  results.push({landing:{before:fallStart,after:structuredClone(TISSUE_IDS.map(id=>options.getState().items[id]))}});
  await captureFrame("rf05-tissues-landed");
  for(const id of TISSUE_IDS){if(options.getState().items[id].location==="bin")continue;await action({type:"pickup",item:id});await action({type:"deliver",item:id,target:"bin"});}
  if(!TISSUE_IDS.every(id=>options.getState().items[id].location==="bin"))throw Error("Not all three tissues were disposed");
  results.push({tissueTask:{window:options.getState().wind,items:TISSUE_IDS.map(id=>options.getState().items[id]),complete:options.getState().complete}});
 }
 async function recordFlight(){
  const start=options.getState().wind.clock,rows=[];
  for(let i=0;i<12;i++){await sleep(250);rows.push({clock:options.getState().wind.clock,items:structuredClone(TISSUE_IDS.map(id=>options.getState().items[id]))});}
  if(!rows.every(row=>row.items.every(t=>t.location!=="air"||Math.abs(Math.hypot(t.vx,t.vy,t.vz)-r.LEVEL.moveSpeed*2.5)<1e-6)))throw Error("Flight speed mismatch");
  results.push({flight:{start,rows}});
  await captureFrame("rf05-tissues-flight");
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
 function button(text,fn){if(r.LEVEL.id!=="rf05-3"&&["验证空中抓纸巾","验证关窗落地回收","记录纸巾飞行","验证关窗","定位窗户"].includes(text))return;const b=document.createElement("button");b.textContent=text;b.style.cssText="margin:4px;padding:5px";b.onclick=async()=>{if(active)return;active=true;try{await fn();status.textContent=JSON.stringify({result:"PASSED",count:results.length,complete:options.getState().complete,last:controller.lastResult});}catch(e){status.textContent="FAILED: "+e.message;}finally{active=false;panel.dataset.results=JSON.stringify(results);}};panel.append(b);}
 button("验证持物墙碰撞",async()=>{
  if(!options.getState().carriedItem)await action({type:"pickup",item:"towel"});
  place({x:-3.25,z:0,yaw:-Math.PI/2});await pulse("W",1.3);
  if(options.getState().player.x < -3.52)throw Error("Payload crossed west wall");
  const stopX=options.getState().player.x;await pulse("S",1.2);await sleep(300);
  if(options.getState().player.x<=stopX)throw Error("Cannot retreat from wall");
  results.push({wallContact:{stopX,retreatX:options.getState().player.x}});
 });
 button("验证全任务",async()=>{await recover();if(r.LEVEL.id!=="rf05")await restock();if(r.LEVEL.id==="rf05-3"){await collectTissues();await pushTo("chair");await pushTo("cart");await action({type:"exit"});}if(!options.getState().complete)throw Error("Final objective did not complete");});button("验证三件回收",recover);button("验证两套补给",restock);button("验证空中抓纸巾",catchAir);button("验证关窗落地回收",collectTissues);button("记录纸巾飞行",recordFlight);button("验证椅子归位",()=>pushTo("chair"));button("验证推车归位",()=>pushTo("cart"));
 for(const [name,a]of [["定位毛巾",{type:"pickup",item:"towel"}],["定位窗户",{type:"window-close"}],["定位推车",{type:"grip",key:"cart"}],["定位椅子",{type:"grip",key:"chair"}],["定位交房",{type:"exit"}]])button(name,()=>station(a));
 button("F 正式交互",()=>action(r.getInteraction(options.getState()),false));
 for(const key of ["W","S","A","D","Q","E"])button(key+" 0.5秒",async()=>{window.dispatchEvent(new KeyboardEvent("keydown",{code:key.startsWith("Arrow")?key:"Key"+key,bubbles:true}));await sleep(500);window.dispatchEvent(new KeyboardEvent("keyup",{code:key.startsWith("Arrow")?key:"Key"+key,bubbles:true}));});
 button("场景几何记录",()=>{status.textContent=JSON.stringify({supports:controller.world.supportMetrics,items:Object.fromEntries(Object.entries(controller.world.serviceItems).map(([id,m])=>[id,{visible:m.visible,pos:m.position.toArray()}]))},null,2);});
 button("低头查看",()=>pulse("ArrowDown",.6));
 button("抬头查看",()=>pulse("ArrowUp",.65));
 button("查看房顶",()=>place({x:0,z:.2,yaw:Math.PI}));
 button("查看风动窗户",()=>place({x:2.40,z:-3.55,yaw:Math.PI}));
 button("验证关窗",()=>action({type:"window-close"}));
 button("记录当前状态",()=>{status.textContent=JSON.stringify(controller.snapshot());});
 button("查看床头",()=>place({x:-1,z:-3.45,yaw:Math.PI}));
 button("查看床上毛巾",()=>place({x:-2.30,z:-1.72,yaw:Math.PI}));
 button("查看马桶靠墙",()=>place({x:-2.65,z:3.65,yaw:Math.PI/2}));
 button("查看卫生间",()=>place({x:-2.60,z:3.15,yaw:.4}));
 button("验证床头取杯",async()=>{await action({type:"pickup",item:"cup"});await captureFrame("rf05-cup-evidence");await action({type:"deliver",item:"cup",target:"cart"});});
 button("验证毛巾取放",async()=>{
  await action({type:"pickup",item:"towel"});await action({type:"deliver",item:"towel",target:"laundry"});
  for(const item of ["towel1","towel2"]){await action({type:"pickup",item});await action({type:"restock",item,slot:item});}
 });
 button("验证远侧连续毛巾",async()=>{
  if(!options.getState().delivered.towel){await action({type:"pickup",item:"towel"});await action({type:"deliver",item:"towel",target:"laundry"});}
  for(const [item,side]of [["towel1",1],["towel2",1]]){
   const p=itemPose(item,options.getState());place({x:p.x,z:p.z+side*.95,yaw:side<0?0:Math.PI});
   await action({type:"pickup",item},false);await captureFrame("rf05-"+item+"-held");
   await action({type:"restock",item,slot:item});
  }
 });
 button("验证原把手短推转向",async()=>{
  await action({type:"grip",key:"cart"});await sleep(400);await captureFrame("rf05-cart-grip");
  const before=structuredClone(options.getState().furniture.cart);
  await pulse("W",.4);await pulse("Q",.4);await sleep(300);await captureFrame("rf05-cart-turn");
  const after=structuredClone(options.getState().furniture.cart),grip=controller.snapshot().gripError;
  if(Math.hypot(after.x-before.x,after.z-before.z)<.06||Math.abs(after.yaw-before.yaw)<.1)throw Error("Cart did not move and turn");
  if(grip>.055)throw Error("Cart hand contact lost");
  await pulse("S",.4);await pulse("E",.4);await action({type:"release",key:"cart"},false);
  results.push({cartMovement:{before,after,grip}});
 });
 button("查看原推车把手",()=>place({x:1.05,z:1.72,yaw:0}));
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
 button("验证窗边床边碰撞",async()=>{
  place({x:2.65,z:-4.0,yaw:Math.PI});await pulse("W",2.0);await sleep(300);
  const windowStop={...options.getState().player};if(windowStop.z< -4.37||windowStop.z> -4.28)throw Error("Crossed sash envelope");
  await pulse("S",1.8);await sleep(300);const windowRetreat={...options.getState().player};if(windowRetreat.z<=windowStop.z+.05)throw Error("Window retreat blocked");
  place({x:.88,z:-1.5,yaw:Math.PI});await pulse("W",2.0);await sleep(300);
  const bedStop={...options.getState().player};if(bedStop.z< -1.806||bedStop.z> -1.72)throw Error("Crossed bed");
  await pulse("S",1.8);await sleep(300);const bedRetreat={...options.getState().player};if(bedRetreat.z<=bedStop.z+.05)throw Error("Bed retreat blocked");
  results.push({windTaskCollisions:{windowStop,windowRetreat,bedStop,bedRetreat}});
 });
 button("验证卫生间碰撞",async()=>{
  place({x:-2.65,z:3.65,yaw:Math.PI/2});await pulse("W",1.4);
  const stop=options.getState().player.x;if(stop> -2.121)throw Error("Crossed visible toilet");
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
