import puppeteer from 'puppeteer-core';import fs from 'node:fs';
const out=process.env.QA_OUT??'./authoring/server-production/rf07-series-v1/evidence';const wait=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/opt/arc-runtime/browser/chrome/linux-153.0.8010.36/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-angle=gl-egl','--disable-dev-shm-usage']});
try{const p=await b.newPage();await p.setViewport({width:1440,height:900});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto((process.env.QA_BASE??'http://127.0.0.1:4173/')+'?mode=play&level=rf07-3&view=first&rf07qa=1',{waitUntil:'networkidle0',timeout:120000});await p.waitForFunction(()=>window.__RF07_QA__&&!document.querySelector('#start-button').disabled,{timeout:90000});await p.click('#start-button');
await p.evaluate(()=>__RF07_QA__.teleport({x:0,z:3.8,yaw:Math.PI}));await p.keyboard.down('ArrowUp');await wait(1200);await p.keyboard.up('ArrowUp');await wait(1000);await p.screenshot({path:out+'/first-ceiling.png'});const first=await p.evaluate(()=>__RF07_QA__.world());
await p.click('#game-shell [data-view-option="third"]');await wait(800);await p.screenshot({path:out+'/third-open-roof.png'});const third=await p.evaluate(()=>__RF07_QA__.world());
await p.evaluate(()=>__RF07_QA__.fixture('device'));await p.evaluate(()=>__RF07_QA__.station('device-off'));await wait(1000);await p.screenshot({path:out+'/device-alarm.png'});
const collision=await p.evaluate(()=>({cabinet:__RF07_QA__.collision({x:9,z:0,yaw:Math.PI/2},{move:1,turn:0,strafe:0},150),wall:__RF07_QA__.collision({x:0,z:-5.5,yaw:Math.PI},{move:1,turn:0,strafe:0},150),tray:__RF07_QA__.collision({x:-8.8,z:4.1,yaw:-Math.PI/2},{move:1,turn:0,strafe:0},150)}));
const resources=await p.evaluate(()=>performance.getEntriesByType('resource').map(x=>x.name));fs.writeFileSync(out+'/network-assets.json',JSON.stringify(resources,null,2));
const performance=await p.evaluate(()=>({animation:__RF07_QA__.snapshot(),renderer:document.querySelector('canvas')?.getContext('webgl2')?.getParameter(7937)}));fs.writeFileSync(out+'/views-collision.json',JSON.stringify({first,third,errors,collision,performance},null,2));
}finally{await b.close();}
