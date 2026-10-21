import puppeteer from 'puppeteer-core';import fs from 'node:fs';
const out=process.env.QA_OUT??'./authoring/server-production/rf07-series-v1/evidence';
const b=await puppeteer.launch({executablePath:'/opt/arc-runtime/browser/chrome/linux-153.0.8010.36/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-angle=gl-egl','--disable-dev-shm-usage','--disable-background-timer-throttling']});
const p=await b.newPage();await p.setViewport({width:1440,height:900});const errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.message)});
const level=process.argv[2]??'rf07-2',testCase=process.argv[3]??'inspection';const wait=ms=>new Promise(r=>setTimeout(r,ms));
try{
await p.goto((process.env.QA_BASE??'http://127.0.0.1:4173/')+'?mode=play&level='+level+'&rf07qa=1&view='+(process.env.QA_VIEW??'third'),{waitUntil:'networkidle0',timeout:120000});
await p.waitForFunction(()=>window.__RF07_QA__&&!document.querySelector('#start-button').disabled,{timeout:120000});
await p.click('#start-button');await wait(1500);await p.screenshot({path:out+'/'+level+'-'+testCase+'-overview.png'});
const action=async(type,item)=>{console.log('STATION',await p.evaluate(([t,i])=>__RF07_QA__.station(t,i),[type,item]));await p.keyboard.press('KeyF');let seen=false;
 for(let i=0;i<100;i++){await wait(650);const s=await p.evaluate(()=>__RF07_QA__.snapshot());if(s.phase!=='idle')seen=true;if(i%8===0)console.log('PHASE',s.phase,s.error,s.lastResult);if([4,12,22].includes(i))await p.screenshot({path:out+'/'+testCase+'-'+type+'-'+(item??'')+'-'+i+'.png'});if(s.phase==='idle'){console.log('RESULT',JSON.stringify(s.lastResult));if(!seen)throw Error('No animation');if(s.lastResult?.type==='timeout')throw Error('Animation timeout');return;} }
 throw Error('Animation never completed');};
if(testCase==='inspection'){const s=await p.evaluate(()=>__RF07_QA__.state());const on=Object.keys(s.cabinetPower).find(k=>s.cabinetPower[k]);await action('cabinet-power',on);const a=await p.evaluate(()=>__RF07_QA__.state());for(const k of Object.keys(a.cabinetPower))if(!a.cabinetPower[k])await action('cabinet-power',k);}
if(testCase==='device'){await p.evaluate(()=>__RF07_QA__.fixture('device'));await action('device-off');}
if(testCase==='install'){await p.evaluate(()=>__RF07_QA__.fixture('module-install'));await action('install-cooling');await action('case-seal');}
if(testCase==='sample'){await action('sample','sampleA');await action('drop');await action('sample','sampleA');await action('case-load');await action('cooling-module');await action('drop');}
if(testCase==='pickup-finish'){await p.evaluate(()=>__RF07_QA__.fixture('carry-case'));await action('case-pickup');const s=await p.evaluate(()=>__RF07_QA__.state());if(!s.complete||s.settling||s.delivered||s.carriedItem!=='transport-case')throw Error('Pickup completion failed');}
if(testCase==='case'){await p.evaluate(()=>__RF07_QA__.fixture('carry-case'));await action('case-pickup');await action('drop');await action('case-pickup');await action('cabinet','cold-02');}
console.log('FINAL',JSON.stringify(await p.evaluate(()=>__RF07_QA__.state())));await p.screenshot({path:out+'/'+level+'-'+testCase+'-final.png'});fs.writeFileSync(out+'/'+level+'-'+testCase+'.json',JSON.stringify({errors,state:await p.evaluate(()=>__RF07_QA__.state()),animation:await p.evaluate(()=>__RF07_QA__.snapshot())},null,2));
}catch(e){console.error(e);await p.screenshot({path:out+'/'+level+'-'+testCase+'-error.png'});process.exitCode=1;}finally{await b.close();}
