import test from "node:test";
import assert from "node:assert/strict";
import {createClinicEngine,SERIES_PROGRESS} from "../game/levels/rf13/series-engine.js";
import {STATIONS,LEVEL} from "../game/levels/rf13/level.js";
const pose=(s,p)=>({...s,player:{x:p.x,z:p.z+.8,yaw:Math.PI}});
function pickup(e,s,id){const p=s.items[id];for(const radius of [.9,1,1.1])for(let i=0;i<64;i++){const yaw=i*Math.PI/32,t={...s,player:{x:p.x-Math.sin(yaw)*radius,z:p.z-Math.cos(yaw)*radius,yaw}};if(e.isWalkable(t,t.player.x,t.player.z)&&e.getInteraction(t,{type:"pickup",item:id}))return e.interact(t,{type:"pickup",item:id});}throw Error("No pickup stand "+id);}
function deliver(e,s,id){const p=STATIONS.find(p=>p.id===id);return e.interact(pose(s,{x:p.x-.4,z:p.z}),{type:"deliver",station:id});}
function returnBox(e,s){return e.interact(pose(s,{x:LEVEL.returns.x-.75+Math.min(3,s.returned.length)*.5,z:LEVEL.returns.z}),{type:"return"});}
test("low needs only two correct supplies, no empty boxes or furniture",()=>{
 const e=createClinicEngine("low");let s=e.createInitialState(1);
 s=deliver(e,pickup(e,s,"gloves"),"exam-a");s=deliver(e,pickup(e,s,"gauze"),"exam-b");
 assert.equal(e.isReady(s),true);assert.equal(s.returned.length,0);assert.equal(s.prepared.length,0);
 s=e.interact(pose(s,LEVEL.terminal));assert.equal(s.terminalOpen,true);s=e.interact(s);assert.equal(s.complete,true);
});
test("medium preserves four deliveries, four returns, two preparations",()=>{
 const e=createClinicEngine("medium");let s=e.createInitialState(1);
 s=deliver(e,pickup(e,s,"gloves"),"exam-a");s=deliver(e,pickup(e,s,"gauze"),"exam-b");assert.equal(e.isReady(s),false);
 for(const p of STATIONS.slice(2))s=deliver(e,pickup(e,s,p.item),p.id);
 for(const p of STATIONS)s=returnBox(e,pickup(e,s,"empty-"+p.id));
 assert.equal(s.returned.length,4);assert.equal(e.isReady(s),false);s.prepared=["chair","trolley"];assert.equal(e.isReady(s),true);
});
test("wrong destination and absent request do not consume cargo or complete work",()=>{
 const e=createClinicEngine("high");let s=e.createInitialState(1);s=pickup(e,s,"gloves");
 const bad=deliver(e,s,"exam-a");assert.equal(bad.carriedItem,"gloves");assert.equal(bad.delivered.length,0);
 const wrong=deliver(e,s,"exam-b");assert.equal(wrong.carriedItem,"gloves");assert.equal(wrong.delivered.length,0);
});
test("six seeded requests complete with at least 60 seconds between every call",()=>{
 for(const seed of [1,9,1024]){
  const e=createClinicEngine("high");let s=e.createInitialState(seed);
  assert.equal(s.requests.filter(r=>r.status==="active").length,0);
  s=e.updateEnvironment(s,4);assert.equal(e.activeRequests(s).length,1);
  s=e.updateEnvironment(s,59.999);assert.equal(e.activeRequests(s).length,1);
  s=e.updateEnvironment(s,.001);assert.equal(e.activeRequests(s).length,2);
  for(let wave=1;wave<=3;wave++){
   assert.equal(s.wave,wave);
   for(const req of e.activeRequests(s)){s=pickup(e,s,req.item);assert.equal(s.carriedItem,req.item);s=req.kind==="return"?returnBox(e,s):deliver(e,s,req.station);}
   assert.equal(e.activeRequests(s).length,0);
   if(wave<3){
    s=e.updateEnvironment(s,.1);s=e.updateEnvironment(s,59.899);
    assert.equal(s.wave,wave); // Batch completion cannot bypass the global interval.
    s=e.updateEnvironment(s,.001);assert.equal(s.wave,wave+1);
    s=e.updateEnvironment(s,60);
   }
  }
  const issued=s.requests.map(r=>r.issuedAt);
  for(let i=1;i<issued.length;i++)assert.ok(issued[i]-issued[i-1]>=60-1e-9);
  assert.equal(s.requests.filter(r=>r.status==="completed").length,6);assert.equal(e.isReady(s),true);
 }
});
test("ordinary and urgent deadlines fail at exactly 120 seconds even with terminal open",()=>{
 for(const urgent of [false,true]){
  const e=createClinicEngine("high");let s=e.createInitialState(17);s.wave=3;s.nextWaveAt=null;
  s.requests.forEach(r=>{r.status="completed";r.issuedAt=0;});
  const r=s.requests.find(r=>r.urgent===urgent);r.status="active";
  s=e.updateEnvironment(s,119.999);assert.equal(s.failed,false);
  s.terminalOpen=true;s=e.updateEnvironment(s,.001);assert.equal(s.failed,true);
  assert.equal(s.failureReason,urgent?"urgent_timeout":"request_timeout");assert.equal(s.expiredRequestId,r.id);assert.equal(s.terminalOpen,false);
  assert.equal(e.interact(s),s);
 }
});
test("completed urgent request is safe and reset clears timers",()=>{
 const e=createClinicEngine("high");let s=e.createInitialState(7);s.wave=3;s.nextWaveAt=null;
 s.requests.forEach(r=>{r.status=r.urgent?"active":"completed";r.issuedAt=0;});
 const r=s.requests.find(r=>r.urgent);s=e.updateEnvironment(s,119);s=deliver(e,pickup(e,s,r.item),r.station);
 s=e.updateEnvironment(s,500);assert.equal(s.failed,false);
 s=e.createInitialState(7);assert.equal(s.clock,0);assert.equal(s.lastRequestAt,null);assert.equal(s.failed,false);assert.equal(e.activeRequests(s).length,0);
});
test("background frame delay does not bunch calls or defer an expired call",()=>{
 const e=createClinicEngine("high");let s=e.createInitialState(6);
 s=e.updateEnvironment(s,500);assert.equal(e.activeRequests(s).length,1);assert.equal(s.lastRequestAt,500);
 s=e.updateEnvironment(s,60);assert.equal(e.activeRequests(s).length,2);
 s=e.updateEnvironment(s,60);assert.equal(s.failed,true);assert.equal(s.clock,620);
});
test("all clinic modes use preceding levels' movement and interaction costs",()=>{
 assert.equal(SERIES_PROGRESS.actionDrainPerSecond,1.5);assert.equal(SERIES_PROGRESS.interactionCost,5);
 for(const mode of ["low","medium","high"]){
  const e=createClinicEngine(mode);let s=e.createInitialState(1);s.player={x:-1,z:2,yaw:0};
  for(let i=0;i<20;i++)s=e.updateMovement(s,{move:.1},.05);
  assert.ok(Math.abs(s.progress-98.5)<1e-8);
  const idle=e.updateMovement(s,{},.05);assert.equal(idle.progress,s.progress);
  const noDrain=e.updateMovement(s,{move:.1,drain:false},.05);assert.equal(noDrain.progress,s.progress);
  const picked=pickup(e,s,"gloves");assert.equal(picked.progress,s.progress-5);
  const depleted=e.updateMovement({...s,progress:.01},{move:.1},.05);assert.equal(depleted.failed,true);
 }
});
test("shared architecture collision blocks wall and allows the entry",()=>{
 const e=createClinicEngine("low");let s=e.createInitialState(1);
 assert.equal(e.isWalkable(s,-7,2),false);assert.equal(e.isWalkable(s,0,4.1),true);
 s={...s,player:{x:-6.0,z:2,yaw:-Math.PI/2}};const start=s.player.x;
 for(let i=0;i<80;i++)s=e.updateMovement(s,{move:1,drain:false},.05);
 assert.ok(s.player.x<start);assert.ok(s.player.x>-6.9);
});

test("furniture motion is collision checked and only final parking settles preparation",()=>{
 const e=createClinicEngine("medium");let s=e.createInitialState(3);
 s={...s,player:{x:-.1,z:1,yaw:Math.PI/2},movingFurniture:"trolley",furnitureOrigin:{x:-.1,z:1},furniturePosition:{x:.8,z:1}};
 for(let i=0;i<100;i++)s=e.updateMovement(s,{move:.3,drain:false},.05);
 assert.ok(s.furniturePositions.trolley.x>.8);assert.equal(s.prepared.length,0);
 assert.equal(e.finishFurniture(s,"trolley"),s);
 const block={...s,player:{x:5.1,z:2.5,yaw:Math.PI/2},furnitureOrigin:{x:5.1,z:2.5},furniturePosition:{x:6,z:2.5}};
 assert.equal(e.isWalkable(block,6.3,2.5),false);
});
test("request progression cannot skip a pending second request",()=>{
 const e=createClinicEngine("high");let s=e.createInitialState(6);s=e.updateEnvironment(s,4);
 const a=e.activeRequests(s)[0];s=deliver(e,pickup(e,s,a.item),a.station);
 s=e.updateEnvironment(s,59);assert.equal(s.wave,1);s=e.updateEnvironment(s,1);assert.equal(e.activeRequests(s).length,1);
});

test("dropped low boxes block legs without trapping the player's upper-body envelope",()=>{
 const e=createClinicEngine("low");let s=e.createInitialState(5);s=pickup(e,s,"gauze");s={...s,player:{x:-1,z:2,yaw:0}};
 s=e.interact(s);assert.equal(s.items.gauze.location,"floor");assert.equal(e.isWalkable(s,-1,2),true);assert.equal(e.isWalkable(s,-1,2.52),false);
 const n=e.updateMovement(s,{move:-1,drain:false},.05);assert.ok(n.player.z<s.player.z);
});
