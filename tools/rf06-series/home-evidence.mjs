import puppeteer from "puppeteer-core";import fs from "node:fs";
const out="./authoring/server-production/rf06-home-v3/evidence";fs.mkdirSync(out,{recursive:true});
const b=await puppeteer.launch({executablePath:"/opt/arc-runtime/browser/chrome/linux-153.0.8010.36/chrome-linux64/chrome",headless:true,protocolTimeout:120000,args:["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-dev-shm-usage"]});
try{
 const p=await b.newPage();await p.setViewport({width:1280,height:800});const errors=[],httpErrors=[];p.on("response",r=>{if(r.status()>=400)httpErrors.push({url:r.url(),status:r.status()});});
 p.on("pageerror",e=>errors.push(e.message));p.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 await p.goto("http://127.0.0.1:4173/rf06-series-v1-r11/?mode=play&level=rf06-2&view=third&rf06qa=1",{waitUntil:"networkidle0",timeout:120000});
 await p.waitForFunction(()=>window.__RF06_QA__&&!document.querySelector("#start-button").disabled,{timeout:120000});await p.click("#start-button");
 await p.screenshot({path:out+"/third-formal.png"});
 const hide=async()=>p.addStyleTag({content:".mission-panel,#operator-console,#rf06-qa,.telemetry-panel,.bottom-hud{visibility:hidden!important}"});
 let style=await hide();await p.screenshot({path:out+"/third-clear.png"});await style.evaluate(e=>e.remove());
 await p.evaluate(()=>__RF06_QA__.place({x:-2.95,z:1.45,yaw:0}));await p.click('[data-view-option="first"]');style=await hide();await p.screenshot({path:out+"/kitchen-first.png"});await style.evaluate(e=>e.remove());
 await p.evaluate(()=>{const q=__RF06_QA__;let s=q.state();for(let i=0;i<3600;i++)s=q.runtime.updateEnvironment(s,.05);q.world().controller.options.setState(s);q.place({x:-.7,z:1.75,yaw:-Math.PI/2});});
 await p.click('[data-view-option="third"]');style=await hide();await p.screenshot({path:out+"/flood-to-living.png"});await style.evaluate(e=>e.remove());
 fs.writeFileSync(out+"/browser.json",JSON.stringify(await p.evaluate(errors=>({errors,release:"rf06-series-v1-r11",assets:{...document.querySelector("#game-shell").dataset},state:__RF06_QA__.state(),simulatedEnvironmentSeconds:180}),errors),null,2));
 fs.writeFileSync(out+"/http-errors.json",JSON.stringify(httpErrors,null,2));console.log("CAPTURED",errors,httpErrors);
}finally{await b.close();}
