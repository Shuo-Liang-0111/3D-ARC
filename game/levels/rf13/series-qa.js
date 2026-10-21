import {STATIONS,SUPPLIES,LEVEL,PREPARATIONS} from "./level.js";
import {createClinicEngine} from "./series-engine.js";
export function installClinicQA(c){
 const panel=document.createElement("aside");panel.id="clinic-qa";panel.style.cssText="position:fixed;bottom:20px;left:2%;z-index:90;background:#eee;color:#123;max-width:700px;max-height:40px;overflow:auto;font:12px monospace;padding:8px";
 const title=document.createElement("b");title.textContent="定点动画测试夹具（非导航通关）";panel.append(title);
 const button=(name,fn)=>{const b=document.createElement("button");b.textContent=name;b.onclick=fn;panel.append(b);};
 function place(point){
  c.cancel();c.reset();const s=c.options.getState(),r=c.options.runtime;
  const candidates=[];
  for(const radius of [.85,.95,1.02])for(let i=0;i<64;i++){
   const yaw=i*Math.PI/32,p={x:point.x-Math.sin(yaw)*radius,z:point.z-Math.cos(yaw)*radius,yaw};
   if(r.isWalkable({...s,player:p},p.x,p.z)&&r.getInteraction({...s,player:p}))candidates.push(p);
  }
  const p=candidates.sort((a,b)=>Math.abs(a.x-point.x)-Math.abs(b.x-point.x))[0];
  if(p)c.options.setState({...s,player:p});else c.options.message("该测试点无可用站位");
 }
 for(const p of SUPPLIES)button("站位："+p.name,()=>{const s=c.options.getState(),item=s.items[p.id];c.reset();c.options.setState({...s,player:{x:item.x+.96,z:item.z,yaw:-Math.PI/2}});});
 for(const p of STATIONS){button("站位："+p.name,()=>place({x:p.x-.4,z:p.z+.2}));button("站位：空盒"+p.name,()=>place({x:p.x+.5,z:p.z+.2}));}
 button("站位：回收",()=>{const s=c.options.getState();c.reset();c.options.setState({...s,player:{x:LEVEL.returns.x-.75+Math.min(3,s.returned.length)*.5,z:1.95,yaw:Math.PI}});});
 button("站位：终端",()=>{const s=c.options.getState();c.reset();c.options.setState({...s,player:{x:3.5,z:3.4,yaw:Math.PI}});});
 for(const p of PREPARATIONS)button("站位："+p.id,()=>{const s=c.options.getState(),dir=p.id==="chair"?-1:1;c.reset();c.options.setState({...s,player:{x:p.x-dir*1.06,z:p.z,yaw:dir*Math.PI/2}});});
 button("视角近景提示",()=>{c.options.message("使用第三视角滚轮放大检查手部，或切换第一视角");});
 button("执行 F",()=>c.interact());
 button("收起测试面板",()=>{panel.style.maxHeight="40px";});
 button("展开测试面板",()=>{panel.style.maxHeight="230px";});
 button("暂停关键帧",()=>{c.qaPaused=!c.qaPaused;});
 button("布置：加急已等待119秒",()=>{
  c.reset();const e=createClinicEngine("high"),s=e.createInitialState(17);s.wave=3;s.nextWaveAt=null;s.clock=200;s.lastRequestAt=81;
  for(const r of s.requests){r.status=r.wave<3?"completed":"active";r.issuedAt=r.urgent?81:200;}
  c.options.setState(s);c.options.runtime.resetClock();c.qaFixture="urgent deadline boundary; earlier requests are fixture state, not playthrough";
 });
 button("站位：前台灯",()=>{const s=c.options.getState();c.reset();c.options.setState({...s,player:{x:4.30,z:3.45,yaw:Math.PI}});});
 button("站位：空地",()=>{const s=c.options.getState();c.reset();c.options.setState({...s,player:{x:-1,z:2,yaw:0}});});
 button("站位：西墙",()=>{const s=c.options.getState();c.options.setState({...s,player:{x:-6.0,z:2.0,yaw:-Math.PI/2}});});
 button("短距碰撞：向前",()=>{c.qaDrive={input:{move:1},remaining:1.2};});
 const pre=document.createElement("pre");pre.id="clinic-qa-state";panel.append(pre);document.body.append(panel);
 c.qaUpdate=()=>{panel.hidden=!document.getElementById("start-overlay")?.hidden;const s=c.options.getState();pre.textContent=JSON.stringify({...c.snapshot(),player:s.player,progress:s.progress,clock:s.clock,requests:s.requests,carried:s.carriedItem,done:s.requests.filter(r=>r.status==="completed").length,failed:s.failed,complete:s.complete,fixture:c.qaFixture,walk:c.walk.snapshot()},null,2);};
}
