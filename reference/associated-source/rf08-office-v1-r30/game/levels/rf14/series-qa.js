import { BINS,sheltered,REVISION } from "./series-layout.js";
export function installQA(c){
 const o=c.options,p=document.createElement("div");p.id="tennis-qa";p.style.cssText="position:absolute;top:285px;left:25px;width:275px;max-height:240px;overflow:auto;z-index:100;background:#102820ed;color:white;padding:8px;font:11px monospace;";
 document.querySelector("#game-shell").append(p);
 const action=(label,fn)=>{const b=document.createElement("button");b.textContent=label;b.onclick=fn;b.style.cssText="margin:3px;padding:5px;color:#fff;background:#395346;border:1px solid #7a8";p.append(b);};
 function at(x,z,yaw){if(c.busy)return;o.stop();const s=o.getState();o.setState({...s,player:{x,z,yaw}});}
 action("站位：黄球",()=>{const b=[o.getState().items["ball-3"],...Object.values(o.getState().items)].find(b=>b.type==="yellow"&&b.location==="floor");if(b)at(b.x,b.z+.7,Math.PI);});
 action("站位：橙球",()=>{const b=Object.values(o.getState().items).find(b=>b.type==="orange"&&b.location==="floor");if(b)at(b.x,b.z+.7,Math.PI);});
 for(const b of BINS)action("站位："+(b.id==="yellow"?"黄筐":"橙筐"),()=>at(b.x-.92,b.z,Math.PI/2));
 action("站位：棚内",()=>at(8.25,-2,-Math.PI/2));
 action("站位：棚外",()=>at(5.9,-2,Math.PI/2));
 action("站位：柱边",()=>at(6.1,-4.8,Math.PI/2));
 action("测试降雨",()=>{const s=o.getState();o.setState({...s,weather:{...s.weather,enabled:true,raining:true,storm:s.weather.storm+1,remaining:75,exposure:0}});o.runtime.resetWeatherClock();});
 action("暴露29秒夹具",()=>{const s=o.getState();o.setState({...s,weather:{...s.weather,enabled:true,raining:true,remaining:75,exposure:29}});o.runtime.resetWeatherClock();});
 action("清空天气夹具",()=>{const s=o.getState();o.setState({...s,weather:{...s.weather,raining:false,remaining:3600,exposure:0}});o.runtime.resetWeatherClock();});
 action("接触时暂停",()=>{c.qaStopAt="contact";});
 action("暂停动画",()=>{c.qaPaused=!c.qaPaused;});
 action("F 正式交互",()=>c.interact());
 const pre=document.createElement("pre");pre.id="tennis-qa-state";pre.style.cssText="white-space:pre-wrap;font-size:10px;max-height:80px;overflow:auto";p.append(pre);
 let last=0;c.qaUpdate=()=>{if(performance.now()-last<200)return;last=performance.now();const s=o.getState();pre.textContent=JSON.stringify({revision:REVISION,progress:s.progress,player:s.player,carried:s.carriedItem,delivered:s.delivered,weather:s.weather,failed:s.failed,complete:s.complete,animation:c.snapshot()},null,1);};
}
