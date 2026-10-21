import puppeteer from './node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
const browser=await puppeteer.launch({executablePath:'/opt/arc-runtime/browser/chrome/linux-153.0.8010.36/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage();await page.setViewport({width:1280,height:800,deviceScaleFactor:1});
page.on('pageerror',e=>console.log('ERROR',e.message));
await page.goto('http://127.0.0.1:4173/?mode=play&level=rf04&physics=none',{waitUntil:'networkidle0',timeout:120000});
await page.locator('#start-button').click().catch(()=>{}); await new Promise(r=>setTimeout(r,2000));
await page.screenshot({path:'./authoring/server-production/rf04-series-v1/evidence/baseline.png'});
console.log(await page.evaluate(()=>({text:document.body.innerText.slice(-2400),data:document.querySelector('#game-shell')?.dataset,state:window.__RELAY_DEMO__?.getState()})));
await browser.close();
