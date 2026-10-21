import test from "node:test";
import assert from "node:assert/strict";
import { createCourtEngine } from "../game/levels/rf14/series-engine.js";
import { BINS,SHELTER,sheltered,POSTS,SERIES_BALLS } from "../game/levels/rf14/series-layout.js";
const e=createCourtEngine("rf14-3"),sort=createCourtEngine("rf14-2");
function at(s,p){return {...s,player:{x:p.x-.9,z:p.z,yaw:Math.PI/2}};}
function rainy(s,exposure=0,remaining=75){return {...s,weather:{...s.weather,raining:true,remaining,exposure,storm:1}};}
test("all three variants use the same ball and collider layout",()=>{for(const id of ["rf14","rf14-2","rf14-3"]){const r=createCourtEngine(id),s=r.createInitialState();assert.equal(Object.keys(s.items).length,8);assert.equal(r.LEVEL.staticColliders.length,e.LEVEL.staticColliders.length);assert.deepEqual(s.player,e.LEVEL.playerStart);}});
test("four balls per type; wrong bin is recoverable and does not count",()=>{
 let s=sort.createInitialState();s=at(s,s.items["ball-1"]);s=sort.interact(s);assert.equal(s.carriedItem,"ball-1");
 s=at(s,BINS[1]);s=sort.interact(s);assert.equal(s.lastEvent,"wrong_bin");assert.equal(s.delivered.length,0);
 s=sort.interact(s);assert.equal(s.carriedItem,"ball-1");
 s=at(s,BINS[0]);s=sort.interact(s);assert.equal(s.delivered.length,1);
 assert.equal(SERIES_BALLS.filter(b=>b.type==="yellow").length,4);
});
test("completion requires all 8 in correct bins; basic level accepts either bin",()=>{
 for(const id of ["rf14","rf14-2"]){const r=createCourtEngine(id);let s=r.createInitialState();
 for(const b of SERIES_BALLS){s=at(s,s.items[b.id]);s=r.interact(s);assert.equal(s.carriedItem,b.id);s=at(s,BINS.find(x=>x.id===(id==="rf14"?"yellow":b.type)));s=r.interact(s);}
 assert.equal(s.complete,true);assert.equal(s.delivered.length,8);
 const before=JSON.stringify(s);s=r.interact(s);assert.equal(JSON.stringify(s),before);
 }
});
test("rain timing range and seeded schedule; no weather before start tick",()=>{
 for(let seed=0;seed<30;seed++){let s=e.createInitialState({seed});assert.ok(s.weather.remaining>=45&&s.weather.remaining<=90);assert.equal(s.weather.raining,false);
 s.player={x:8.25,z:-2,yaw:0};s=e.updateEnvironment(s,s.weather.remaining);assert.equal(s.weather.raining,true);assert.ok(s.weather.remaining>=60&&s.weather.remaining<=90);assert.equal(s.weather.storm,1);
 const dry=e.updateEnvironment(s,s.weather.remaining);assert.equal(dry.weather.raining,false);assert.ok(dry.weather.remaining>=45&&dry.weather.remaining<=90);
 }
 assert.deepEqual(e.createInitialState({seed:33}),e.createInitialState({seed:33}));
});
test("exactly 30 seconds passes, more than 30 fails; shelter pauses but does not erase",()=>{
 let s=rainy(e.createInitialState());s=e.updateEnvironment(s,20);assert.equal(s.weather.exposure,20);
 s.player={x:8.25,z:-2,yaw:0};s=e.updateEnvironment(s,8);assert.equal(s.weather.exposure,20);assert.equal(s.weather.sheltered,true);
 s.player={x:5.9,z:-2,yaw:0};s=e.updateEnvironment(s,10);assert.equal(s.failed,false);assert.equal(s.weather.exposure,30);
 s=e.updateEnvironment(s,.001);assert.equal(s.failed,true);assert.equal(s.failureReason,"rain_exposure");
});
test("exposure resets only at next storm; large deltas split at boundaries",()=>{
 let s=rainy(e.createInitialState(),20,5);s.player={x:8.25,z:-2,yaw:0};s=e.updateEnvironment(s,5);assert.equal(s.weather.exposure,20);
 s=e.updateEnvironment(s,s.weather.remaining);assert.equal(s.weather.exposure,0);assert.equal(s.weather.storm,2);
 s=e.updateEnvironment(s,700);assert.equal(s.failed,false);assert.ok(s.weather.storm>2);assert.equal(s.progress,100);
});
test("roof edges require full body cover including forward envelope",()=>{
 const r=e.LEVEL.playerRadius;
 assert.equal(sheltered({x:8.25,z:-2,yaw:0}),true);
 assert.equal(sheltered({x:SHELTER.minX+r-.01,z:-2,yaw:Math.PI/2}),false);
 assert.equal(sheltered({x:SHELTER.maxX-r-.02,z:-2,yaw:Math.PI/2}),false);
});
test("posts, bins and net block short actual movement; shelter entrance is open",()=>{
 let s=e.createInitialState();s.player={x:6.0,z:-4.8,yaw:Math.PI/2};
 for(let i=0;i<100;i++)s=e.updateMovement(s,{move:1},.05);
 assert.ok(s.player.x<POSTS[0].position[0]-.2);
 s.player={x:6,z:-2,yaw:Math.PI/2};for(let i=0;i<75;i++)s=e.updateMovement(s,{move:1},.05);assert.ok(s.player.x>7.0);assert.ok(s.player.x<9.6);
 s.player={x:0,z:1.0,yaw:Math.PI};for(let i=0;i<60;i++)s=e.updateMovement(s,{move:1},.05);assert.ok(s.player.z>.1);
 s.player={x:7,z:10,yaw:Math.PI/2};for(let i=0;i<80;i++)s=e.updateMovement(s,{move:1},.05);assert.ok(s.player.x<7.8);
});
test("reset removes weather exposure and carried ball; completed/failed clocks stop",()=>{
 let s=e.createInitialState();s=rainy(s,31);s=e.updateEnvironment(s,.01);assert.equal(s.failed,true);assert.deepEqual(e.updateEnvironment(s,80),s);
 s=e.createInitialState();assert.equal(s.weather.exposure,0);assert.equal(s.weather.storm,0);assert.equal(s.carriedItem,null);
 s.complete=true;assert.deepEqual(e.updateEnvironment(s,80),s);
 const easy=sort.createInitialState();assert.equal(sort.updateEnvironment(easy,1000).weather.raining,false);
});

test("all tennis levels charge actual movement, not idle, turning or passive drift",()=>{
 for(const id of ["rf14","rf14-2","rf14-3"]){
  const r=createCourtEngine(id);let s=r.createInitialState();s.player={x:0,z:8,yaw:0};
  const moved=r.updateMovement(s,{move:1},.05),distance=Math.hypot(moved.player.x-s.player.x,moved.player.z-s.player.z);
  assert.ok(distance>0);assert.ok(Math.abs(moved.progress-(100-distance*.4))<1e-9);
  assert.equal(r.updateMovement(s,{},.05).progress,100);
  assert.equal(r.updateMovement(s,{turn:1},.05).progress,100);
  assert.equal(r.updateMovement(s,{move:.1,passiveMotion:true},.05).progress,100);
  s.player={x:8.25,z:-2,yaw:0};assert.equal(r.updateEnvironment(s,600).progress,100);
 }
});

test("pickup, drop, wrong placement, retrieval and empty interaction cost two; correct return rewards six",()=>{
 let s=sort.createInitialState();s.progress=70;
 s=sort.interact(s);assert.equal(s.progress,68);
 s=at(s,s.items["ball-1"]);s=sort.interact(s);assert.equal(s.progress,66);
 s=at(s,BINS[1]);s=sort.interact(s);assert.equal(s.progress,64);assert.equal(s.lastEvent,"wrong_bin");
 s=sort.interact(s);assert.equal(s.progress,62);
 s=at(s,BINS[0]);s=sort.interact(s);assert.equal(s.progress,66);assert.equal(s.lastEvent,"ball_sorted");
 s=at(s,s.items["ball-2"]);s=sort.interact(s);assert.equal(s.progress,64);
 s=sort.interact(s);assert.equal(s.lastEvent,"ball_dropped");assert.equal(s.progress,62);
});

test("animation charges at start and does not charge again at contact",()=>{
 let s=at(sort.createInitialState(),SERIES_BALLS[0]);s.progress=80;
 const action=sort.getInteraction(s);s=sort.chargeInteraction(s);assert.equal(s.progress,78);
 s=sort.interact(s,action,{charge:false});assert.equal(s.progress,78);assert.equal(s.carriedItem,"ball-1");
 s=at(s,BINS[0]);const release=sort.getInteraction(s);s=sort.chargeInteraction(s);assert.equal(s.progress,76);
 s=sort.interact(s,release,{charge:false});assert.equal(s.progress,82);
});

test("return reward is capped and each ball earns it at most once",()=>{
 let s=sort.createInitialState();s=at(s,s.items["ball-1"]);s=sort.interact(s);s=at(s,BINS[0]);s=sort.interact(s);
 assert.equal(s.progress,100);assert.equal(s.items["ball-1"].returnRewarded,true);
 // Replayed/restored placement cannot mint another reward for the same ball.
 s={...s,carriedItem:"ball-1",items:{...s.items,"ball-1":{...s.items["ball-1"],location:"carried",bin:null}},delivered:[],progress:70};
 s=sort.interact(s,{type:"deliver",item:"ball-1",bin:"yellow"});assert.equal(s.progress,68);
});

test("reserve depletion fails without completing an action and reset restores the budget",()=>{
 let s=at(sort.createInitialState(),SERIES_BALLS[0]);s.progress=2;
 const failed=sort.interact(s);assert.equal(failed.failed,true);assert.equal(failed.failureReason,"reserve_depleted");assert.equal(failed.carriedItem,null);assert.equal(failed.progress,0);
 assert.equal(sort.getObjective(failed).title,"任务余量耗尽");
 s=sort.createInitialState();s.progress=.001;s.player={x:0,z:8,yaw:0};s=sort.updateMovement(s,{move:1},.05);
 assert.equal(s.failed,true);assert.equal(s.progress,0);
 assert.deepEqual(sort.updateEnvironment(s,100),s);assert.equal(sort.createInitialState().progress,100);
});
