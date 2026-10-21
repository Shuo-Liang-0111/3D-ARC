import {POINTS,HOME,SEATS,TYPES,distance,chairStand,furniturePoint} from "./office-layout.js";
// Only imported with qa=office. Stations move the robot, never objects or task completion.
export function installOfficeQA(c){
 const api=c.options,r=api.runtime,panel=document.createElement("aside");
 panel.id="office-qa";panel.style.cssText="position:fixed;left:12px;bottom:75px;z-index:1000;background:#152027ed;color:#fff;padding:8px;font:12px monospace;max-width:440px;max-height:270px;overflow:auto";
 panel.innerHTML='<b>定点动作验收 / TEST ONLY</b><br><select id="office-qa-station" aria-label="验收站位"></select> <button id="office-qa-place">布置站位</button><br><button id="office-qa-left">左移 0.6 米</button> <button id="office-qa-forward">前进 1 秒</button> <button id="office-qa-turn">转向 1 秒</button> <button id="office-qa-suite">验收本关代表动作</button> <button id="office-qa-capture">定帧画面</button> <button id="office-qa-hide">收起</button><pre id="office-qa-status" style="white-space:pre-wrap;margin:4px 0"></pre>';
 document.body.append(panel);
 const select=panel.querySelector("select");
 const entries=[...Object.keys(api.getState().items).map(x=>["pickup:"+x,"拿起 "+x]),...Object.keys(HOME).map(x=>["return:"+x,"归还 "+x]),...SEATS.flatMap(s=>[["seat:"+s.id+":doc","席位 "+s.id+" 资料"],["seat:"+s.id+":water","席位 "+s.id+" 水"]]),["paper-load","打印机补纸"],["printer","打印按钮"],["deliver:print","交付资料"],["deliver:water","饮水补给"],["deliver:collect","资料回收"],["confirm","会议确认"],["grip:chair-a","推椅 A"],["grip:chair-b","推椅 B"],["wall","墙边碰撞"],["table","桌边碰撞"],["glass","隔断碰撞"],["door","门洞通行"],["drop","空地放下"]];
 for(const[value,label]of entries){const o=document.createElement("option");o.value=value;o.textContent=label;select.append(o);}
 function station(value){
  if(c.action)throw Error("动作进行中");
  const s=r.cloneState(api.getState());const [type,key,kind]=value.split(":");let a,p;
  if(["wall","table","glass","door","drop"].includes(type)){
   s.player=({wall:{x:11.9,z:7.3,yaw:Math.PI/2},table:{x:5.4,z:-5.2,yaw:-Math.PI/2},glass:{x:7,z:-3.1,yaw:0},door:{x:0,z:-1,yaw:Math.PI},drop:{x:0,z:3.7,yaw:0}})[type];
  }else{
   if(type==="pickup"){p=s.items[key];a={type,target:key,item:key};}
   else if(type==="return"){p=HOME[key];a={type,target:key,item:s.carriedItem};}
   else if(type==="seat"){p=SEATS.find(x=>x.id===key)[kind];a={type,target:key,kind,item:s.carriedItem};}
   else if(type==="deliver"){p=POINTS[({print:"delivery",water:"refill",collect:"recycle"})[key]];a={type,target:key,item:s.carriedItem};}
   else if(type==="paper-load"){p=POINTS.printerInput;a={type,target:"printer",item:s.carriedItem};}
   else if(type==="printer"){p=POINTS.printerButton;a={type,target:"printer"};}
   else if(type==="confirm"){p=POINTS.terminal;a={type,target:"terminal"};}
   else if(type==="grip"){p=furniturePoint(s.chairs[key]);a={type,chair:key};}
   let candidates=[];
   for(const radius of [.85,1.05,1.2])for(let i=0;i<48;i++){
    const yaw=i*Math.PI/24,stand={x:p.x-Math.sin(yaw)*radius,z:p.z-Math.cos(yaw)*radius,yaw};
    const st={...s,player:stand};if(!r.isWalkable(st,stand.x,stand.z))continue;
    const actual=r.getInteraction(st);
    if(actual&&actual.type===a.type&&actual.target===a.target&&actual.item===a.item&&actual.chair===a.chair&&actual.kind===a.kind)candidates.push({stand,score:distance(stand,s.player)});
   }
   candidates.sort((a,b)=>a.score-b.score);
   if(!candidates.length)throw Error("无法找到正式 F 可选站位: "+value);
   s.player=candidates[0].stand;
  }
  if(!r.isWalkable(s,s.player.x,s.player.z))throw Error("站位被碰撞阻挡");
  api.stop();api.setState(s);return r.getInteraction(s);
 }
 panel.querySelector("#office-qa-place").onclick=()=>{try{station(select.value);panel.dataset.error="";}catch(e){panel.dataset.error=e.message;}};
 const drive=(input,seconds)=>{if(c.action)return;c.qaDrive={input,remaining:seconds};};
 panel.querySelector("#office-qa-left").onclick=()=>drive({strafe:1},.60/r.LEVEL.moveSpeed);
 panel.querySelector("#office-qa-forward").onclick=()=>drive({move:1},1);
 panel.querySelector("#office-qa-turn").onclick=()=>drive({turn:1},1);
 panel.querySelector("#office-qa-capture").onclick=()=>requestAnimationFrame(()=>{
  const canvas=document.querySelector("#game-shell canvas"),frame=document.createElement("img");
  frame.alt="办公室正式游戏画面 "+api.getState().level+" "+document.querySelector("#game-shell").dataset.viewMode;
  frame.src=canvas.toDataURL("image/png");frame.style.cssText="position:fixed;left:12px;top:105px;width:280px;z-index:1010;border:2px solid white";frame.id="office-captured-frame";
  document.querySelector("#office-captured-frame")?.remove();document.body.append(frame);
 });
 panel.querySelector("#office-qa-hide").onclick=()=>{panel.style.display="none";};
 let suite=null;
 const run=(station,expect)=>({station,expect});
 const pick=id=>run("pickup:"+id,"pickup");
 const place=(station,expect)=>run(station,expect);
 panel.querySelector("#office-qa-suite").onclick=()=>{
  if(c.action||suite)return;
  const id=api.getState().level;
  const steps=id==="rf09"?[pick("folder"),place("return:folder","return"),pick("tray"),place("return:tray","return"),pick("remote"),place("return:remote","return")]:id==="rf09-2"?[
   pick("docs-1"),place("seat:1:doc","seat"),pick("water-1"),place("seat:1:water","seat"),
   place("grip:chair-a","grip"),{drive:{strafe:-1},seconds:.60/r.LEVEL.moveSpeed},place(null,"release"),
   place("confirm","not_ready"),{station:"wall",drive:{move:1},seconds:1},{station:"glass",drive:{move:1},seconds:1},{station:"door",drive:{move:1},seconds:1}
  ]:[pick("paper"),place("paper-load","paper-load"),place("printer","printer"),{waitPrinter:true},pick("printed"),place("deliver:print","deliver"),pick("water-5"),place("deliver:water","deliver"),pick("water-6"),place("deliver:water","deliver"),pick("used"),place("deliver:collect","deliver")];
  suite={steps,index:0,stage:"next",results:[],status:"running",started:performance.now()};panel.dataset.suite=JSON.stringify(suite);
 };
 function suiteUpdate(){
  if(!suite||suite.status!=="running")return;
  const fail=message=>{suite.status="failed";suite.error=message;};
  try{
   const step=suite.steps[suite.index];
   if(!step){suite.status="passed";return;}
   if(suite.stage==="next"){
    if(c.action||c.qaDrive)return;
    if(step.waitPrinter){if(api.getState().printer.phase!=="ready")return;suite.index++;return;}
    if(step.station)station(step.station);
    suite.before={player:{...api.getState().player},contacts:c.contacts.length};suite.deadline=performance.now()+42000;
    if(step.drive)c.qaDrive={input:step.drive,remaining:step.seconds};else c.interact();suite.stage="wait";
   }else if(performance.now()>suite.deadline)fail("timeout "+JSON.stringify(step));
   else if(!c.action&&!c.qaDrive){
    const result=step.drive?{player:{...api.getState().player},chairs:api.getState().chairs}:c.lastResult;
    if(step.expect&&(!result||result.event!==step.expect||c.contacts.length<=suite.before.contacts)){fail("unexpected action "+JSON.stringify({step,result}));return;}
    suite.results.push({step,before:suite.before,result,phase:c.snapshot().phase});suite.index++;suite.stage="next";
   }
  }catch(e){fail(e.message);}
  finally{panel.dataset.suite=JSON.stringify(suite);}
 }
 let last=0;
 c.qaUpdate=()=>{suiteUpdate();if(performance.now()-last<150)return;last=performance.now();const s=api.getState(),snap=c.snapshot();const interaction=r.getInteraction(s);panel.querySelector("pre").textContent=JSON.stringify({suite:suite?{status:suite.status,index:suite.index,error:suite.error}:null,phase:snap.phase,target:interaction?.label,contact:snap.lastResult,error:panel.dataset.error||null},null,1);panel.dataset.snapshot=JSON.stringify(snap);panel.dataset.state=JSON.stringify(s);panel.dataset.interaction=JSON.stringify(interaction);};
 window.__OFFICE_QA__={state:()=>structuredClone(api.getState()),snapshot:()=>c.snapshot(),objects:()=>Object.fromEntries(Object.entries(c.world.items).map(([k,o])=>[k,{visible:o.visible,position:o.position.toArray()}]))};
}
