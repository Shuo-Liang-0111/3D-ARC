from pathlib import Path

def replace(f,a,b):
 p=Path(f);s=p.read_text();assert a in s,(f,a);p.write_text(s.replace(a,b))
replace('game/app.js','const mujocoEnabled = robotId === "g1" && !isCooperativeLevel && !isOfficeSeries;','const mujocoEnabled = robotId === "g1" && !isCooperativeLevel;')
replace('game/levels/rf09/office-layout.js','progress:{initial:100,maximum:100,actionDrainPerSecond:0,interactionCost:0}','progress:{initial:ORIGINAL.progress.initial,maximum:ORIGINAL.progress.maximum,actionDrainPerSecond:ORIGINAL.progress.actionDrainPerSecond,interactionCost:ORIGINAL.progress.interactionCost,pickupReward:ORIGINAL.progress.pickupReward,placementReward:ORIGINAL.progress.installReward}')
f='game/levels/rf09/office-engine.js'
replace(f,'returned:{...s.returned}','returned:{...s.returned},rewarded:{...s.rewarded}')
replace(f,'progress:100,complete:false','progress:LEVEL.progress.initial,rewarded:{},complete:false')
replace(f,' function updateMovement(s,input,seconds){',''' function failIfDepleted(n){
  if(n.progress<=1e-6&&!n.complete){n.progress=0;n.failed=true;n.motion="idle";n.terminalOpen=false;n.lastEvent="progress_depleted";}
  return n;
 }
 function reward(n,key,amount){if(!n.rewarded[key]){n.rewarded[key]=true;n.progress=Math.min(LEVEL.progress.maximum,n.progress+amount);}}
 const taskItem=item=>id==="rf09"?["folder","tray","remote"].includes(item):id==="rf09-2"?/^(docs|water)-[1-4]$/.test(item):["paper","printed","water-5","water-6","used"].includes(item);
 function updateMovement(s,input={},seconds=0){''')
replace(f,'n.motion=m.motionTurning?"turning":m.translating?"moving":s.carriedItem?"carrying":s.attachment?"pushing":"idle";return n;','''// Match preceding levels: translation intent consumes reserve, including a blocked attempt.
  // Pure rotation, passive simulation drift and scripted F alignment do not.
  if(m.translating&&input.drain!==false&&!input.passiveMotion)n.progress=Math.max(0,s.progress-LEVEL.progress.actionDrainPerSecond*dt);
  n.motion=m.motionTurning?"turning":m.translating?"moving":s.carriedItem?"carrying":s.attachment?"pushing":"idle";return failIfDepleted(n);''')
replace(f,'  n.interactions++;','  n.interactions++;n.progress=Math.max(0,n.progress-LEVEL.progress.interactionCost);')
replace(f,'if(!a){n.lastEvent="no_target";return n;}','if(!a){n.lastEvent="no_target";return failIfDepleted(n);}')
replace(f,':"wrong_target";return n;}',':"wrong_target";return failIfDepleted(n);}')
replace(f,'   if(item.id in n.returned)n.returned[item.id]=false;','   if(item.id in n.returned)n.returned[item.id]=false;\n   if(taskItem(item.id))reward(n,"pickup:"+item.id,LEVEL.progress.pickupReward);')
replace(f,'   if(a.type==="drop")item.location="floor";','''   if(a.type==="drop")item.location="floor";
   const milestone=a.type==="return"&&id==="rf09"?"return:"+a.target
    :a.type==="seat"&&id==="rf09-2"?"seat:"+a.target+":"+a.kind
    :a.type==="paper-load"&&id==="rf09-3"?"paper-load"
    :a.type==="deliver"&&id==="rf09-3"?"deliver:"+a.target+(a.target==="water"?":"+n.requests[1].count:""):null;
   if(milestone)reward(n,milestone,LEVEL.progress.placementReward);''')
replace(f,'else if(a.type==="release"){n.attachment=null;n.motion="idle";}','''else if(a.type==="release"){
   n.attachment=null;n.motion="idle";const c=n.chairs[a.chair];
   if(id==="rf09-2"&&distance(c,c.target)<.14&&Math.abs(Math.atan2(Math.sin(c.yaw-c.target.yaw),Math.cos(c.yaw-c.target.yaw)))<.16)reward(n,"chair:"+c.id,LEVEL.progress.placementReward);
  }''')
replace(f,'  return n;\n }\n function updateEnvironment','  if(n.complete)n.progress=LEVEL.progress.maximum;\n  return failIfDepleted(n);\n }\n function updateEnvironment')
replace(f,'detail:s.complete?"任务完成":"靠近物品或设备按 F 操作"','detail:s.failed?"状态余量耗尽，办公室任务终止":s.complete?"任务完成":"靠近物品或设备按 F 操作"')
f='game/levels/rf09/office-runtime.js'
replace(f,'const messages={pickup:','const messages={progress_depleted:"状态余量耗尽，请重新开始",pickup:')
replace(f,'getTerminal:()=>','getFailureMessage:()=>"状态余量耗尽，办公室任务终止。按 R 重新开始。",getTerminal:()=>')
f='game/levels/rf09/office-animation.js'
replace(f,'import * as THREE from "three";','import * as THREE from "three";\nimport {scaleMujocoVelocityForFrontend} from "../../mujoco-client.js";')
replace(f,'if(this.qaDrive)return {...idle(),...this.qaDrive.input};\n  return s.attachment?input:null;','''if(this.qaDrive){const q=this.qaDrive.input;return scaleMujocoVelocityForFrontend({...idle(),...q,drain:Boolean(q.move||q.strafe)},this.options.runtime.LEVEL);}
  return s.attachment?scaleMujocoVelocityForFrontend(input,this.options.runtime.LEVEL):null;''')
f='game/levels/rf09/office-qa.js'
replace(f,'// Only imported','import {G1_MUJOCO_VELOCITY_LIMITS} from "../../mujoco-client.js";\n// Only imported')
replace(f,'.60/r.LEVEL.moveSpeed','.60/G1_MUJOCO_VELOCITY_LIMITS.lateral')
replace(f,' <button id="office-qa-suite">',' <button id="office-qa-key-w">W 行走 2 秒</button> <button id="office-qa-key-q">Q 转向 2 秒</button> <button id="office-qa-suite">')
replace(f,' const drive=(input,seconds)=>',''' // These controls exercise the ordinary keyboard -> MuJoCo -> frontend path.
 // The existing short drive controls exercise collision-aware scripted movement.
 let keyAudit=null;const keyResults=[];
 function auditKey(code){
  if(c.busy||keyAudit)return;
  api.stop();const s=api.getState();keyAudit={code,before:{player:{...s.player},progress:s.progress},start:performance.now()};
  window.dispatchEvent(new KeyboardEvent("keydown",{code}));
  setTimeout(()=>{
   window.dispatchEvent(new KeyboardEvent("keyup",{code}));
   const n=api.getState();keyAudit.after={player:{...n.player},progress:n.progress};keyAudit.seconds=(performance.now()-keyAudit.start)/1000;
   keyAudit.mujocoStatus=document.querySelector("#game-shell").dataset.mujocoStatus;
   keyResults.push(keyAudit);panel.dataset.keyAudit=JSON.stringify(keyResults);keyAudit=null;
  },2000);
 }
 panel.querySelector("#office-qa-key-w").onclick=()=>auditKey("KeyW");
 panel.querySelector("#office-qa-key-q").onclick=()=>auditKey("KeyQ");
 const drive=(input,seconds)=>''')
