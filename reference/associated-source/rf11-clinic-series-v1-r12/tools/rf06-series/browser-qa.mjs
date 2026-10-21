import puppeteer from "puppeteer-core";
import fs from "node:fs";
const out="./authoring/server-production/rf06-series-v1/evidence";fs.mkdirSync(out,{recursive:true});
const b=await puppeteer.launch({executablePath:"/opt/arc-runtime/browser/chrome/linux-153.0.8010.36/chrome-linux64/chrome",headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader","--disable-dev-shm-usage","--disable-background-timer-throttling"]});
try{
 const p=await b.newPage();await p.setViewport({width:1280,height:800,deviceScaleFactor:1});
 const errors=[];p.on("pageerror",e=>{errors.push(e.message);console.log("PAGEERROR",e.message);});
 const level=process.argv[2]??"rf06-2";
 await p.goto("http://127.0.0.1:4173/?mode=play&level="+level+"&rf06qa=1&view=third",{waitUntil:"networkidle0",timeout:120000});
 await p.waitForFunction(()=>window.__RF06_QA__,{timeout:90000});
 console.log("ASSETS",await p.evaluate(()=>document.querySelector("#game-shell").dataset));
 await p.click("#start-button");await new Promise(r=>setTimeout(r,1000));
 await p.screenshot({path:out+"/"+level+"-overview.png"});
 console.log("INITIAL",await p.evaluate(()=>__RF06_QA__.state()));
 const action=async(a)=>{
  console.log("STATION",a,await p.evaluate(a=>__RF06_QA__.station(a),a));
  await p.keyboard.press("KeyF");
  for(let i=0;i<180;i++){
   await new Promise(r=>setTimeout(r,1500));
   const s=await p.evaluate(()=>__RF06_QA__.snapshot());console.log("PHASE",s.phase,s.error,s.lastResult);
   if([2,5,9].includes(i))await p.screenshot({path:out+"/"+level+"-"+a.type+"-"+(a.item??"")+"-"+i+".png"});
   if(s.phase==="idle"){if(s.lastResult?.type==="timeout")throw Error(JSON.stringify(s));break;}
   if(i===179)throw Error("Action timeout "+JSON.stringify(s));
  }
  console.log("STATE",await p.evaluate(()=>__RF06_QA__.state()));
 };
 await action({type:"pickup",item:"wrench"});
 await action({type:"valve"});
 await action({type:"return",item:"wrench"});
 await action({type:"pickup",item:"bucket"});
 await action({type:"bucket-place"});
 await action({type:"pickup",item:"mop"});
 await action({type:"mop"});
 fs.writeFileSync(out+"/"+level+"-qa.json",JSON.stringify({errors,state:await p.evaluate(()=>__RF06_QA__.state()),animation:await p.evaluate(()=>__RF06_QA__.snapshot())},null,2));
}finally{await b.close();}
