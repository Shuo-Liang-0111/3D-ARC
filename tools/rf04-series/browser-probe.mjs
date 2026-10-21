import puppeteer from "puppeteer-core";import fs from "node:fs";
const out="./authoring/server-production/rf04-series-v1/evidence";
const b=await puppeteer.launch({executablePath:"/opt/arc-runtime/browser/chrome/linux-153.0.8010.36/chrome-linux64/chrome",headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-dev-shm-usage","--disable-background-timer-throttling"]});
const p=await b.newPage();await p.setViewport({width:1280,height:800,deviceScaleFactor:1});
p.on("pageerror",e=>console.log("PAGEERROR",e.message));
await p.goto("http://127.0.0.1:4173/?mode=play&level=rf04-2&rf04qa=1&view=third",{waitUntil:"networkidle0",timeout:120000});
await p.waitForFunction(()=>window.__RF04_QA__,{timeout:90000});
console.log("READY",await p.evaluate(()=>({assets:document.querySelector(".game-shell")?.dataset,s:__RF04_QA__.state()})));
await p.click("#start-button");
await p.evaluate(()=>__RF04_QA__.place({x:-7.1,z:3.12,yaw:0}));
await p.screenshot({path:out+"/rf04-2-entry.png"});
await p.keyboard.press("KeyF");
for(let i=0;i<35;i++){
 await new Promise(r=>setTimeout(r,1800));
 const s=await p.evaluate(()=>__RF04_QA__.snapshot());console.log(JSON.stringify(s));
 if([2,5,10,15,20].includes(i))await p.screenshot({path:out+"/shirt-phase-"+i+".png"});
 if(s.phase==="holding"||s.phase==="idle"){await p.screenshot({path:out+"/shirt-end.png"});break;}
}
await p.evaluate(async()=>{
 const T=await import("/node_modules/three/build/three.module.js"),q=__RF04_QA__,scene=q.world().scene,robot=q.robot();
 const r=new T.WebGLRenderer({antialias:true});r.setSize(1000,800);r.setPixelRatio(1);r.shadowMap.enabled=true;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.12;
 const camera=new T.PerspectiveCamera(43,1.25,.02,100);camera.position.copy(robot.position).add(new T.Vector3(1.9,1.8,2.4));camera.lookAt(robot.position.clone().add(new T.Vector3(0,.65,0)));
 r.render(scene,camera);window.__qaImage=r.domElement.toDataURL("image/png");r.dispose();
});
fs.writeFileSync(out+"/shirt-diagnostic.png",Buffer.from((await p.evaluate(()=>__qaImage)).split(",")[1],"base64"));
console.log("FINAL",await p.evaluate(()=>__RF04_QA__.state()));
await b.close();

