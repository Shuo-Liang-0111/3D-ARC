import test from "node:test";
import assert from "node:assert/strict";
import * as simple from "../game/levels/rf12-2/engine.js";
import * as cooking from "../game/levels/rf12-3/engine.js";
import * as medium from "../game/levels/rf12/engine.js";
import {LEVEL as S} from "../game/levels/rf12-2/level.js";
import {LEVEL as C} from "../game/levels/rf12-3/level.js";
import {KITCHEN,GRIPS,gripPoint} from "../game/levels/rf12/interaction-layout.js";
const at=(s,p)=>({...s,player:{...s.player,...p}});
function cookingStart(){let s=cooking.createInitialState();for(const p of [C.kettle,C.fill,C.burner,C.burner])s=cooking.interact(at(s,p));return s;}
test("oil, kettle, extinguisher and cloth remain recoverable after a local floor drop",()=>{
 for(const [engine,item,pick,field] of [[simple,"oil",S.taskItem,"oil"],[cooking,"kettle",C.kettle,"kettle"],[medium,"cloth",KITCHEN.cloth,"cloth"]]){
  let s=engine.interact(at(engine.createInitialState(),pick));
  assert.equal(s.carriedItem,item);
  s=engine.interact(at(s,{x:0,z:0,yaw:0}));
  const dropped=field==="oil"?s.items.oil:s[field];
  assert.equal(dropped.location,"floor");assert.ok(engine.isWalkable(s,dropped.x,dropped.z));
  assert.ok(Math.hypot(dropped.x-s.player.x,dropped.z-s.player.z)>.3);
  s=engine.interact(at(s,dropped));assert.equal(s.carriedItem,item);
 }
 let s=cookingStart();s=cooking.updateMovement({...s,boilElapsed:65},{},.01);
 s=cooking.interact(at(s,C.extinguisher));s=cooking.interact(at(s,{x:0,z:0,yaw:0}));
 assert.equal(s.extinguisher.location,"floor");s=cooking.interact(at(s,s.extinguisher));assert.equal(s.carriedItem,"extinguisher");
});
test("fire recovery leaves the cylinder at the animated release point and allows another cycle",()=>{
 let s=cookingStart();s=cooking.updateMovement({...s,boilElapsed:65},{},.01);
 s=cooking.interact(at(s,C.extinguisher));
 const releasePoint={x:2.7,y:.006,z:-1.4,yaw:0};
 s=cooking.interact(at(s,C.burner),{type:"extinguish",releasePoint});
 assert.equal(s.fireActive,false);assert.equal(s.extinguisher.location,"floor");
 assert.equal(s.extinguisher.x,releasePoint.x);assert.equal(s.extinguisher.z,releasePoint.z);
 assert.equal(s.boilElapsed,0);
 for(const p of [C.burner,C.fill,C.burner,C.burner])s=cooking.interact(at(s,p));
 assert.equal(s.burnerOn,true);assert.equal(s.boilAttempts,2);
 s=cooking.updateMovement(s,{},65.01);assert.equal(s.fireActive,true);
 s=cooking.interact(at(s,s.extinguisher));assert.equal(s.carriedItem,"extinguisher");
});
test("timing boundaries are inclusive and independent of movement frame clamping",()=>{
 for(const seconds of [55,60,65]){
  let s=cookingStart();s=cooking.updateMovement(s,{},seconds);
  assert.equal(s.fireActive,false);assert.equal(s.boilElapsed,seconds);
  assert.equal(cooking.interact(at(s,C.burner)).complete,true);
 }
 let s=cookingStart();s=cooking.updateMovement(s,{clockDelta:65.001},.05);assert.equal(s.fireActive,true);
 s=cookingStart();s=cooking.updateMovement(s,{},54.999);s=cooking.interact(at(s,C.burner));
 assert.equal(s.complete,false);assert.equal(s.boilElapsed,0);assert.equal(s.burnerOn,false);
});
test("a stale off-switch animation cannot complete a kitchen already on fire",()=>{
 let s=cookingStart();s=cooking.updateMovement(s,{},65.01);
 const result=cooking.interact(at(s,C.burner),{type:"burner-off"});
 assert.equal(result.complete,false);assert.equal(result.fireActive,true);assert.equal(result.interactions,s.interactions);
});
test("local approach movement cannot tunnel through counter, wall or refrigerator",()=>{
 for(const engine of [simple,cooking,medium]){
  for(const player of [{x:1.2,z:-1.84,yaw:Math.PI},{x:3.70,z:0,yaw:Math.PI/2},{x:-2.7,z:-1,yaw:-Math.PI/2}]){
   let s=at(engine.createInitialState(),player);
   for(let i=0;i<45;i++){s=engine.updateMovement(s,{move:1,drain:false},.05);assert.ok(engine.isWalkable(s,s.player.x,s.player.z));}
  }
 }
});
test("all kitchen variants share support coordinates and handles stay inside real prop dimensions",()=>{
 assert.equal(S.taskItem,KITCHEN.oil);assert.equal(S.taskTarget,KITCHEN.prep);
 assert.equal(C.kettle,KITCHEN.kettle);assert.equal(C.fill,KITCHEN.fill);assert.equal(C.burner,KITCHEN.burner);
 assert.ok(S.taskTarget.z< -2.19);assert.equal(S.taskItem.y,.902);
 assert.equal(gripPoint(KITCHEN.pan,"pan").z,KITCHEN.pan.z+GRIPS.pan[2]);
});

test("the environment clock advances while the native robot is idle",()=>{
 let s=cookingStart();
 s=cooking.updateEnvironment(s,60);
 assert.equal(s.boilElapsed,60);assert.equal(s.fireActive,false);
 s=cooking.updateEnvironment(s,5.01);assert.equal(s.fireActive,true);assert.equal(s.burnerOn,false);
 const frozen=cooking.updateEnvironment({...s,complete:true},50);assert.equal(frozen.boilElapsed,s.boilElapsed);
});
