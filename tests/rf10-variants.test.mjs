import test from "node:test";
import assert from "node:assert/strict";
import * as simple from "../game/levels/rf12-2/engine.js";
import * as cooking from "../game/levels/rf12-3/engine.js";
import { LEVEL as SIMPLE_LEVEL } from "../game/levels/rf12-2/level.js";
import { LEVEL as COOK_LEVEL } from "../game/levels/rf12-3/level.js";

function at(state, point) {
  state.player.x = point.x;
  state.player.z = point.z;
  return state;
}

test("RF-10-2 completes one simple oil-bottle placement", () => {
  let state = simple.createInitialState();
  state = simple.interact(at(state, { x: -3.25, z: 2.25 }));
  state = simple.interact(at(state, SIMPLE_LEVEL.taskItem));
  assert.equal(state.carriedItem, "oil");
  state = simple.interact(at(state, SIMPLE_LEVEL.taskTarget));
  assert.equal(state.placed, true);
  state = simple.interact(at(state, { x: -3.35, z: 2.55 }));
  assert.equal(state.complete, true);
});

function readyKettle() {
 let s=cooking.createInitialState();
 for(const p of [COOK_LEVEL.kettle,COOK_LEVEL.fill,COOK_LEVEL.burner,COOK_LEVEL.burner])s=cooking.interact(at(s,p));
 return s;
}
test("RF-10-3 requires pickup, water and placement before ignition",()=>{
 let s=cooking.createInitialState();
 assert.equal(cooking.getInteraction(at(s,COOK_LEVEL.burner)),null);
 s=cooking.interact(at(s,COOK_LEVEL.kettle));
 assert.equal(s.carriedItem,"kettle");assert.equal(s.waterFilled,false);
 assert.equal(cooking.getInteraction(at(s,COOK_LEVEL.burner)).type,"drop");
 s=cooking.interact(at(s,COOK_LEVEL.fill));assert.equal(s.waterFilled,true);
 s=cooking.interact(at(s,COOK_LEVEL.burner));assert.equal(s.kettleOnBurner,true);
 s=cooking.interact(at(s,COOK_LEVEL.burner));assert.equal(s.burnerOn,true);assert.equal(s.boilElapsed,0);
 assert.equal("hoodOn" in s,false);
});
test("early shutdown retains water and starts a fresh heating attempt",()=>{
 let s=cooking.updateEnvironment(readyKettle(),54.9);
 s=cooking.interact(at(s,COOK_LEVEL.burner));
 assert.equal(s.complete,false);assert.equal(s.lastEvent,"boiling_too_early_restart");assert.equal(s.waterFilled,true);
 assert.equal(s.boilElapsed,0);assert.equal(cooking.isBoiling(s),false);
 s=cooking.interact(at(s,COOK_LEVEL.burner));assert.equal(s.boilAttempts,2);assert.equal(s.boilElapsed,0);
 s=cooking.updateEnvironment(s,55);assert.equal(cooking.isBoiling(s),true);
 assert.equal(cooking.interact(at(s,COOK_LEVEL.burner)).complete,true);
});
test("fire invalidates the water and requires extinguishing then actual refill",()=>{
 let s=cooking.updateEnvironment(readyKettle(),65.01);
 assert.equal(s.fireActive,true);assert.equal(s.waterFilled,false);assert.equal(s.refillRequired,true);
 assert.equal(cooking.isBoiling(s),false);
 assert.equal(cooking.getInteraction(at(s,COOK_LEVEL.burner)),null);
 s=cooking.interact(at(s,COOK_LEVEL.extinguisher));s=cooking.interact(at(s,COOK_LEVEL.burner));
 assert.equal(s.fireActive,false);assert.equal(s.boilElapsed,0);
 assert.equal(cooking.getInteraction(at(s,COOK_LEVEL.burner)).type,"pickup-kettle");
 s=cooking.interact(at(s,COOK_LEVEL.burner));
 const stale=cooking.interact(at(s,COOK_LEVEL.burner),{type:"burner-on"});
 assert.equal(stale.burnerOn,false);
 assert.equal(cooking.getInteraction(at(s,COOK_LEVEL.burner)).type,"drop");
 s=cooking.interact(at(s,COOK_LEVEL.fill));assert.equal(s.refillRequired,false);
 s=cooking.interact(at(s,COOK_LEVEL.burner));s=cooking.interact(at(s,COOK_LEVEL.burner));
 assert.equal(s.burnerOn,true);assert.equal(s.boilElapsed,0);assert.equal(s.boilAttempts,2);
});
test("boiling animation state exists only with water and heat inside 55–65 seconds",()=>{
 const base=readyKettle();
 for(const [seconds,expected] of [[54.999,false],[55,true],[60,true],[65,true],[65.001,false]]) {
  const s=cooking.updateEnvironment(base,seconds);
  assert.equal(cooking.isBoiling(s),expected,String(seconds));
 }
 assert.equal(cooking.isBoiling({...base,boilElapsed:60,waterFilled:false}),false);
 assert.equal(cooking.isBoiling({...base,boilElapsed:60,burnerOn:false}),false);
});
