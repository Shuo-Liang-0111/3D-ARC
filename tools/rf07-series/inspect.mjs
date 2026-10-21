import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const b=await puppeteer.launch({executablePath:'/opt/arc-runtime/browser/chrome/linux-153.0.8010.36/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage']});
const p=await b.newPage();await p.setViewport({width:1440,height:900});p.on('pageerror',e=>console.log('ERROR',e.message));
await p.goto('http://127.0.0.1:4173/?mode=play&level=rf07&view=third',{waitUntil:'networkidle0',timeout:120000});
await p.waitForFunction(()=>document.querySelector('#start-button')?.textContent.includes('开始任务'),{timeout:120000});await p.click('#start-button');await new Promise(r=>setTimeout(r,3000));
await p.screenshot({path:'./authoring/server-production/rf07-series-v1/evidence/baseline.png'});console.log(await p.evaluate(()=>window.__RELAY_DEMO__.getState()));await b.close();
