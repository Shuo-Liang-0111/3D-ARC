import { KITCHEN, itemPose, gripPoint, REVISION } from "./interaction-layout.js";
export function installKitchenQA(c) {
 const o=c.options,r=o.runtime,panel=document.createElement("aside");
 panel.id="rf10-qa";panel.style.cssText="position:fixed;left:12px;bottom:94px;width:330px;max-height:310px;overflow:auto;padding:8px;background:#102328eb;color:white;z-index:9999;font:11px monospace";
 const status=document.createElement("pre");status.style.cssText="white-space:pre-wrap;margin:4px";panel.append(status);
 const add=(text,fn)=>{const b=document.createElement("button");b.textContent=text;b.style.cssText="margin:2px;padding:4px";b.onclick=()=>{try{fn();panel.dataset.error="";}catch(e){panel.dataset.error=e.message;status.textContent=e.message;}};panel.append(b);};
 function place(p){if(c.busy)throw Error("Finish current action first");const s=o.getState();if(!r.isWalkable(s,p.x,p.z))throw Error("Blocked station");o.stop();o.setState({...s,player:{...s.player,...p}});}
 const match=(a,b)=>a&&a.type===b;
 function station(type){
  const s=o.getState(),item=({"pickup":"oil","pickup-pan":"pan","pickup-kettle":"kettle","pickup-extinguisher":"extinguisher","cloth":"cloth"})[type];
  const p=item?gripPoint(itemPose(s,item),item):({"place":KITCHEN.prep,"place-pan":KITCHEN.burner,"place-kettle":KITCHEN.burner,"fill-kettle":KITCHEN.fill,"hood":KITCHEN.hood,"burner-on":KITCHEN.knob,"burner-off":KITCHEN.knob,"extinguish":KITCHEN.burner,"checklist":KITCHEN.terminal,"terminal":KITCHEN.terminal,"gasKnob":KITCHEN.knob,"gasValve":KITCHEN.valve,"window":KITCHEN.window,"cloth-safe":KITCHEN.sink})[type];
  if(!p)return;
  for(const radius of [.7,.8,.95,1.15,.5])for(let i=0;i<64;i++){
   const yaw=(p.x< -3.5?-Math.PI/2:Math.PI)+i*Math.PI/32,player={x:p.x-Math.sin(yaw)*radius,z:p.z-Math.cos(yaw)*radius,yaw};
   if(r.isWalkable(s,player.x,player.z)&&match(r.getInteraction({...s,player}),type)){place(player);return;}
  }
  throw Error("No station for "+type);
 }
 const actions=r.LEVEL.id==="rf12-2"?["checklist","pickup","place","drop","terminal"]:r.LEVEL.id==="rf12-3"?["pickup-kettle","fill-kettle","place-kettle","burner-on","burner-off","pickup-extinguisher","extinguish","drop"]:["window","gasKnob","gasValve"];
 for(const type of actions)add("QA "+type,()=>{if(type!=="drop")station(type);c.interact();});
 add("QA 空地放下",()=>{place({x:0,z:0,yaw:0});c.interact();});
 add("QA 隐藏操作面板",()=>{for(const id of ["operator-console","objective-title"]){const e=document.getElementById(id);if(e)e.style.visibility=e.style.visibility==="hidden"?"":"hidden";}});
 add("QA 保存画面",()=>{
  const a=document.getElementById("rf10-frame")??document.createElement("a");
  a.id="rf10-frame";a.textContent="下载当前验收画面";a.download="rf10-kettle-"+Date.now()+".jpg";
  a.href=window.__ARC_AGENT__.observe("visual").screenshot;panel.append(a);
  const img=document.getElementById("rf10-frame-image")??document.createElement("img");img.id="rf10-frame-image";img.alt="RF-10 当前验收截图";img.src=a.href;img.style.cssText="width:100%;display:block";panel.append(img);
 });
 add("QA 复位",()=>{c.reset();o.setState(r.createInitialState());});
 add("QA 沸腾停表",()=>{c.qaBoilingStop=true;});
 add("QA 装水停帧",()=>{c.qaFillStop=true;});
 add("QA 接触停帧",()=>{c.qaStopAt="lift";});
 add("QA 推窗停帧",()=>{c.qaWindowStop=true;});
 add("QA 喷射停帧",()=>{c.qaStopAt=null;c.qaSprayStop=true;});
 add("QA 继续",()=>{c.qaStopAt=null;c.qaPaused=false;c.qaSprayStop=false;c.qaFillStop=false;c.qaBoilingStop=false;c.qaWindowStop=false;});
 if(r.LEVEL.id==="rf12-3")for(const seconds of [54,59,65])add("QA 计时 "+seconds+"s",()=>{let s=o.getState();if(c.busy||!s.burnerOn)throw Error("Start burner and finish animation first");o.setState({...s,boilElapsed:seconds});});
 if(r.LEVEL.id==="rf12-3")for(const seconds of [50,58,59.8])add("QA 火灾 "+seconds+"s",()=>{
  const s=o.getState();if(!s.fireActive||s.failed)throw Error("Active fire required");o.setState({...s,fireElapsed:seconds});
 });
 for(const [label,p]of [["道具近景",{x:2.1,z:-1.65,yaw:Math.PI}],["水壶近景",{x:.15,z:-1.65,yaw:Math.PI}],["水槽近景",{x:-.45,z:-1.65,yaw:Math.PI}],["油瓶近景",{x:-1.6,z:-1.6,yaw:Math.PI}],["灭火器近景",{x:-3.12,z:.9,yaw:-Math.PI/2}],["厨房全景",{x:0,z:1.4,yaw:Math.PI}],["侧窗近景",{x:2.7,z:.35,yaw:Math.PI/2}]])add("QA "+label,()=>place(p));
 const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const run=async type=>{station(type);c.interact();let activeMs=0;while(c.busy){await delay(100);if(!c.qaPaused)activeMs+=100;if(activeMs>90000)throw Error(type+" animation timeout");}if(!c.lastResult||c.lastResult.type!==type)throw Error(JSON.stringify(c.lastResult));};
 if(r.LEVEL.id==="rf12-3")add("QA 烧水准备",async()=>{
  panel.dataset.run="preparing";try{c.reset();o.setState(r.createInitialState());for(const type of ["pickup-kettle","fill-kettle","place-kettle","burner-on"])await run(type);panel.dataset.run="heating";}catch(e){panel.dataset.run="failed";panel.dataset.failure=e.message;}
 });
 add("QA 自动动作验收",async()=>{
  panel.dataset.run="running";try{
   c.reset();o.setState(r.createInitialState());
   const sequence=r.LEVEL.id==="rf12-2"?["checklist","pickup","place","terminal"]:r.LEVEL.id==="rf12-3"?["pickup-kettle","fill-kettle","place-kettle","burner-on"]:["window","gasKnob","gasValve"];
   for(const type of sequence)await run(type);
   if(r.LEVEL.id==="rf12-3") {
    await run("burner-off");
    if(o.getState().lastEvent!=="boiling_too_early_restart")throw Error("Early shutdown did not reset");
    await run("burner-on");
    let s=o.getState();o.setState({...s,boilElapsed:65});
    await delay(250);
    await run("pickup-extinguisher");await run("extinguish");
    if(o.getState().waterFilled||!o.getState().refillRequired)throw Error("Fire must require new water");
    await run("pickup-kettle");await run("fill-kettle");await run("place-kettle");await run("burner-on");
    s=o.getState();o.setState({...s,boilElapsed:54});
    await run("burner-off");
    if(!o.getState().complete)throw Error("Window shutdown did not complete");
   }
   panel.dataset.run="passed";
  }catch(e){panel.dataset.run="failed";panel.dataset.failure=e.message;}
 });
 setInterval(()=>{
  if(c.qaBoilingStop&&o.getState().burnerOn&&o.getState().boilElapsed>=55){o.setState({...o.getState(),boilElapsed:55.5});panel.dataset.clockFixture="boiling-frozen";}
  if(c.qaWindowStop&&c.action?.phase==="window-slide"&&c.world.windowSlide>.20)c.qaPaused=true;
  if(c.qaFillStop&&c.action?.phase==="fill"&&c.action.time>1.5)c.qaPaused=true;
  if(c.qaSprayStop&&c.action?.phase==="spray"&&c.action.time>.7)c.qaPaused=true;
  if(!new URLSearchParams(location.search).has("rf10qa")){const url=new URL(location.href);url.searchParams.set("rf10qa","1");history.replaceState(null,"",url);}
  const snap=c.snapshot(),s=o.getState();panel.dataset.snapshot=JSON.stringify(snap);panel.dataset.state=JSON.stringify(s);
  panel.dataset.scene=JSON.stringify({revision:REVISION,windowSlide:c.world.windowSlide??0,ceiling:c.world.ceilingRoot.visible,extraButtons:!!c.world.scene.getObjectByName("RF10_hood_BUTTON")||!!c.world.scene.getObjectByName("RF10_window_BUTTON"),boiling:c.world.kettleSteam?.visible,filling:c.world.filling,water:c.world.kettleWater?.visible,props:Object.fromEntries(Object.entries(c.world.props).map(([k,p])=>[k,{visible:p.visible,position:p.position.toArray(),children:p.children.length}]))});
  status.textContent=JSON.stringify({phase:snap.phase,contact:snap.error==null?null:+snap.error.toFixed(3),grip:snap.gripError,last:snap.lastResult,event:s.lastEvent,run:panel.dataset.run,error:panel.dataset.error,failure:panel.dataset.failure},null,1);
 },300);
 document.body.append(panel);
}
