import puppeteer from "puppeteer-core";import fs from "node:fs";
const release=process.argv[2]??"rf06-series-v1-r16",out="./authoring/server-production/rf06-tools-v2/evidence";fs.mkdirSync(out,{recursive:true});
const b=await puppeteer.launch({executablePath:"/opt/arc-runtime/browser/chrome/linux-153.0.8010.36/chrome-linux64/chrome",headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-dev-shm-usage"]});
try{
const p=await b.newPage();await p.setViewport({width:1280,height:800});const errors=[];p.on("pageerror",e=>errors.push(e.message));
await p.goto("http://127.0.0.1:4173/"+release+"/?mode=play&level=rf06-2&view=third&rf06qa=1",{waitUntil:"networkidle0",timeout:120000});
await p.waitForFunction(()=>window.__RF06_QA__&&!document.querySelector("#start-button").disabled,{timeout:120000});await p.click("#start-button");
const hide=()=>p.addStyleTag({content:".mission-panel,#operator-console,#rf06-qa,.telemetry-panel,.bottom-hud{visibility:hidden!important}"});
let css=await hide();await p.screenshot({path:out+"/spread-third.png"});await css.evaluate(e=>e.remove());
await p.evaluate(()=>__RF06_QA__.place({x:4.135,z:-2.24,yaw:Math.PI}));await p.click('[data-view-option="first"]');await p.waitForFunction(()=>document.querySelector("#game-shell").dataset.viewMode==="first");css=await hide();await p.screenshot({path:out+"/supported-wrench-first.png"});await css.evaluate(e=>e.remove());
await p.evaluate(()=>__RF06_QA__.place({x:4.3,z:2.22,yaw:Math.PI/2}));css=await hide();await p.screenshot({path:out+"/mop-clip-first.png"});await css.evaluate(e=>e.remove());
fs.writeFileSync(out+"/scene.json",JSON.stringify(await p.evaluate(({release,errors})=>({release,errors,state:__RF06_QA__.state(),assets:{...document.querySelector("#game-shell").dataset},method:"Robot-only view stations; normal production camera; side panels hidden for inspection."}),{release,errors}),null,2));
}finally{await b.close();}
