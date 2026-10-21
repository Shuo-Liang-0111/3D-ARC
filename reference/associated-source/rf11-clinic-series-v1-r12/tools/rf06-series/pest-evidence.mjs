import puppeteer from "puppeteer-core";
import fs from "node:fs";
const out="./authoring/server-production/rf06-series-v1/evidence/r6";fs.mkdirSync(out,{recursive:true});
const b=await puppeteer.launch({executablePath:"/opt/arc-runtime/browser/chrome/linux-153.0.8010.36/chrome-linux64/chrome",headless:true,protocolTimeout:600000,args:["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-dev-shm-usage"]});
try{
const p=await b.newPage();await p.setViewport({width:800,height:500});
await p.goto("http://127.0.0.1:4173/rf06-series-v1-r6/?mode=play&level=rf06-3&rf06qa=1&view=third",{waitUntil:"networkidle0",timeout:120000});
await p.waitForFunction(()=>window.__RF06_PEST_QA__,{timeout:120000});
await p.click("#start-button");
await p.screenshot({path:out+"/third.png"});
const measurements=await p.evaluate(async()=>{
const THREE=await import("/node_modules/three/build/three.module.js");
const q=__RF06_PEST_QA__,robot=q.robot();const feet=[];
robot.traverse(n=>{if(/ankle_roll_link/.test(n.name)){const size=new THREE.Box3().setFromObject(n).getSize(new THREE.Vector3());feet.push({name:n.name,size:size.toArray()});}});
return {feet,state:q.state(),snapshot:q.snapshot()};
});fs.writeFileSync(out+"/dimensions.json",JSON.stringify(measurements,null,2));
await p.evaluate(()=>__RF06_PEST_QA__.place({x:3.95,z:-1.1,yaw:0}));
await p.click('[data-view-option="first"]');
await p.screenshot({path:out+"/first.png"});
await p.click('[data-view-option="third"]');
await p.evaluate(()=>{const q=__RF06_PEST_QA__;q.pickupStation();const state=q.state(),action=q.runtime.getInteraction(state);q.place(q.controller.standFor(state,action));q.controller.interact();});
await p.waitForFunction(()=>__RF06_PEST_QA__.snapshot().phase==="idle",{timeout:600000,polling:1000});
await p.evaluate(()=>__RF06_PEST_QA__.place({x:0,z:0.5,yaw:0}));
await p.setViewport({width:1280,height:800});
await p.click('[data-view-option="first"]');
await p.evaluate(()=>document.querySelector("#rf06-pest-qa").style.display="none");
await p.screenshot({path:out+"/held.png"});
await p.evaluate(()=>__RF06_PEST_QA__.controller.interact());
await p.screenshot({path:out+"/burst-state.png"});
fs.writeFileSync(out+"/interaction.json",JSON.stringify(await p.evaluate(()=>({state:__RF06_PEST_QA__.state(),snapshot:__RF06_PEST_QA__.snapshot()})),null,2));
}catch(e){console.error(e);process.exitCode=1;}finally{await b.close();}
