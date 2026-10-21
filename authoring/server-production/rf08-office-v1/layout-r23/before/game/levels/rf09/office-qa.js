import {SEATS,TASK_ITEMS,PHONE_POINT,distance,furniturePoint} from './office-layout.js';
// Only loaded with qa=office: station setup moves the robot, never props or completion flags.
export function installOfficeQA(c){
 const api=c.options,r=api.runtime,panel=document.createElement('aside');panel.id='office-qa';panel.style.cssText='position:fixed;left:12px;bottom:75px;z-index:1000;background:#152027ed;color:#fff;padding:8px;font:12px monospace;max-width:440px;max-height:270px;overflow:auto';
 panel.innerHTML='<b>定点动作验收 / TEST ONLY</b><br><select aria-label="验收站位"></select> <button id="office-qa-place">布置站位</button><br><button id="office-qa-forward">前进 1 秒</button> <button id="office-qa-turn">转向 1 秒</button> <button id="office-qa-suite">验收本关代表动作</button> <button id="office-qa-timeout">验收来电超时</button> <button id="office-qa-look">低头观察</button> <button id="office-qa-capture">定帧画面</button> <button id="office-qa-hide">收起</button><pre style="white-space:pre-wrap;margin:4px 0"></pre>';
 document.body.append(panel);const select=panel.querySelector('select');
 const entries=[...TASK_ITEMS.map(id=>['pickup:'+id,'拿起 '+id]),['seat:doc','摆放文件'],['seat:water','摆放水'],['grip','推椅'],['answer','接听电话'],['phone-view','观察电话'],['door','入口碰撞'],['door-inside','门内通行'],['wall','墙边碰撞'],['drop','空地放下']];
 for(const[value,label]of entries){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
 function station(value){
  if(c.action)throw Error('动作进行中');
  const s=r.cloneState(api.getState()),[type,key]=value.split(':');let p,a;
  if(['door','door-inside','wall','drop','phone-view'].includes(type))s.player=({'phone-view':{x:PHONE_POINT.x,z:-2.95,yaw:Math.PI},door:{x:0,z:-.9,yaw:Math.PI},'door-inside':{x:0,z:-2.85,yaw:Math.PI/2},wall:{x:11.9,z:7.3,yaw:Math.PI/2},drop:{x:0,z:3.7,yaw:0}})[type];
  else{
   if(type==='pickup'){p=s.items[key];a={type,target:key,item:key};}
   if(type==='seat'){p=SEATS[0][key];a={type,target:'1',kind:key,item:s.carriedItem};}
   if(type==='grip'){p=furniturePoint(s.chairs['chair-a']);a={type,chair:'chair-a'};}
   if(type==='answer'){p=PHONE_POINT;a={type,target:'phone'};}
   const candidates=[];
   for(const radius of [.85,1.05,1.2])for(let i=0;i<64;i++){
    const yaw=i*Math.PI/32,player={x:p.x-Math.sin(yaw)*radius,z:p.z-Math.cos(yaw)*radius,yaw},st={...s,player};
    if(!r.isWalkable(st,player.x,player.z))continue;
    const actual=r.getInteraction(st);if(actual&&actual.type===a.type&&actual.target===a.target&&actual.item===a.item&&actual.chair===a.chair&&actual.kind===a.kind)candidates.push({player,score:distance(player,s.player)});
   }
   candidates.sort((a,b)=>a.score-b.score);if(!candidates.length)throw Error('无法找到正式 F 站位：'+value);s.player=candidates[0].player;
  }
  if(!r.isWalkable(s,s.player.x,s.player.z))throw Error('站位被碰撞阻挡');api.stop();api.setState(s);
 }
 panel.querySelector('#office-qa-place').onclick=()=>{try{station(select.value);panel.dataset.error='';}catch(e){panel.dataset.error=e.message;}};
 const drive=(input,seconds)=>{if(!c.action)c.qaDrive={input,remaining:seconds};};
 panel.querySelector('#office-qa-forward').onclick=()=>drive({move:1},1);
 panel.querySelector('#office-qa-turn').onclick=()=>drive({turn:1},1);
 panel.querySelector('#office-qa-look').onclick=()=>{window.dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowDown'}));setTimeout(()=>window.dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowDown'})),900);};
 panel.querySelector('#office-qa-capture').onclick=()=>requestAnimationFrame(()=>{const image=document.createElement('img');image.id='office-captured-frame';image.src=document.querySelector('#game-shell canvas').toDataURL('image/png');image.alt='正式办公室画面';image.style.cssText='position:fixed;left:12px;top:105px;width:280px;z-index:1010';document.querySelector('#office-captured-frame')?.remove();document.body.append(image);});
 panel.querySelector('#office-qa-hide').onclick=()=>panel.style.display='none';
 let suite=null;
 function begin(timeout=false){
  if(c.action||suite)return;const id=api.getState().level,steps=[];
  if(id!=='rf09')steps.push({station:'door',drive:{move:1},seconds:1.5,blocked:true},{station:'grip',expect:'grip'},{drive:{move:1},seconds:1.5},{expect:'chair_parked'},{station:'door',drive:{move:1},seconds:1.5,passes:true});
  steps.push({station:'pickup:docs-1',expect:'pickup'},{station:'seat:doc',expect:id==='rf09-3'?'phone_ringing':'seat'});
  if(id==='rf09-3'){
   if(timeout)steps.push({waitFailure:true});else steps.push({station:'answer',expect:'phone_answered'});
  }
  if(!timeout)steps.push({station:'pickup:water-1',expect:'pickup'},{station:'seat:water',expect:'setup_complete'});
  suite={steps,index:0,stage:'next',results:[],status:'running',started:performance.now()};
 }
 panel.querySelector('#office-qa-suite').onclick=()=>begin(false);
 panel.querySelector('#office-qa-timeout').onclick=()=>begin(true);
 function tick(){
  if(!suite||suite.status!=='running')return;
  try{
   const step=suite.steps[suite.index];if(!step){suite.status='passed';return;}
   if(suite.stage==='next'){
    if(c.action||c.qaDrive)return;
    if(step.station)station(step.station);
    const s=api.getState();suite.before={player:{...s.player},contacts:c.contacts.length,progress:s.progress,clock:s.clock,phone:{...s.phone}};suite.deadline=performance.now()+(step.waitFailure?35000:44000);
    if(step.drive)drive(step.drive,step.seconds);else if(!step.waitFailure)c.interact();suite.stage='wait';
   }else if(performance.now()>suite.deadline)throw Error('timeout '+JSON.stringify(step));
   else if(step.waitFailure){
    if(api.getState().failed){if(api.getState().failureReason!=='phone_timeout')throw Error('unexpected failure');suite.results.push({step,before:suite.before,state:api.getState()});suite.index++;suite.stage='next';}
   }else if(!c.action&&!c.qaDrive){
    const s=api.getState(),result=step.drive?{player:{...s.player},chairs:s.chairs}:c.lastResult;
    if(step.expect&&(!result||result.event!==step.expect||c.contacts.length<=suite.before.contacts))throw Error('unexpected action '+JSON.stringify({step,result}));
    if(step.blocked&&s.player.z<-1.47)throw Error('chair did not block the entrance');
    if(step.passes&&s.player.z>-2.25)throw Error('doorway did not reopen');
    suite.results.push({step,before:suite.before,result,phase:c.snapshot().phase,phone:{...s.phone}});suite.index++;suite.stage='next';
   }
  }catch(e){suite.status='failed';suite.error=e.message;}
  finally{panel.dataset.suite=JSON.stringify(suite);}
 }
 let last=0;c.qaUpdate=()=>{tick();if(performance.now()-last<150)return;last=performance.now();const s=api.getState(),snapshot=c.snapshot();panel.querySelector('pre').textContent=JSON.stringify({suite:suite?{status:suite.status,index:suite.index,error:suite.error}:null,phase:snapshot.phase,event:s.lastEvent,phone:s.phone,error:panel.dataset.error||null},null,1);panel.dataset.state=JSON.stringify(s);panel.dataset.snapshot=JSON.stringify(snapshot);panel.dataset.interaction=JSON.stringify(r.getInteraction(s));};
}
