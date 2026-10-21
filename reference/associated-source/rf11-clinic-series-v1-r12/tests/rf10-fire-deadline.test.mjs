import test from "node:test";
import assert from "node:assert/strict";
import * as engine from "../game/levels/rf12-3/engine.js";
import { LEVEL } from "../game/levels/rf12-3/level.js";
const at=(s,p)=>({...s,player:{...s.player,...p}});
function heating(){
 let s=engine.createInitialState();
 for(const p of [LEVEL.kettle,LEVEL.fill,LEVEL.burner,LEVEL.burner])s=engine.interact(at(s,p));
 return s;
}
const fire=()=>engine.updateEnvironment(heating(),65.01);
test("fire has its own 60 second deadline with ignition-frame remainder",()=>{
 let s=fire();assert.ok(Math.abs(s.fireElapsed-.01)<1e-6);
 s=engine.updateEnvironment(s,59.98);
 assert.equal(s.failed,false);assert.ok(Math.abs(s.fireElapsed-59.99)<1e-6);
 s=engine.updateEnvironment(s,.01);
 assert.equal(s.failed,true);assert.equal(s.fireElapsed,60);
 assert.equal(s.failureReason,"fire_timeout");
 assert.match(engine.getFailureMessage(s),/60 秒/);
 assert.equal(s.complete,false);assert.equal(engine.getInteraction(s),null);
});
test("a delayed environment frame can cross both ignition and fire deadline",()=>{
 const s=engine.updateEnvironment(heating(),126);
 assert.equal(s.failed,true);assert.equal(s.failureReason,"fire_timeout");
 assert.equal(s.fireElapsed,60);assert.equal(s.burnerOn,false);
});
test("fire countdown advances while stationary and via movement clock only once",()=>{
 let s=engine.updateMovement(fire(),{environmentClock:true,clockDelta:0},.05);
 assert.ok(Math.abs(s.fireElapsed-.01)<1e-6);
 s=engine.updateEnvironment(s,10);assert.ok(Math.abs(s.fireElapsed-10.01)<1e-6);
 assert.match(engine.getTelemetry(s).gate,/50.0s/);
 s=engine.updateMovement(s,{clockDelta:50},.05);assert.equal(s.failed,true);
});
test("extinguishing before the deadline keeps recovery viable and resets the next fire",()=>{
 let s=engine.interact(at(fire(),LEVEL.extinguisher));
 s=engine.updateEnvironment(s,59.98);
 s=engine.interact(at(s,LEVEL.burner),{type:"extinguish",holdAfter:true});
 assert.equal(s.fireActive,false);assert.equal(s.fireElapsed,0);
 assert.equal(s.carriedItem,"extinguisher");
 s=engine.updateEnvironment(s,30);assert.equal(s.failed,false);
 const reserveAfterSpray=s.progress;
 s=engine.interact(at(s,{x:0,z:0}),{type:"drop"});
 assert.equal(s.progress,reserveAfterSpray);assert.equal(s.extinguisherReleasePending,false);
 assert.equal(s.extinguisher.location,"floor");assert.equal(s.refillRequired,true);
 for(const p of [LEVEL.burner,LEVEL.fill,LEVEL.burner,LEVEL.burner])s=engine.interact(at(s,p));
 s=engine.updateEnvironment(s,65.5);
 assert.equal(s.failed,false);assert.equal(s.fireElapsed,.5);
});
test("a late pending extinguish cannot reverse failure or clear the fire",()=>{
 let s=engine.interact(at(fire(),LEVEL.extinguisher));
 s=engine.updateEnvironment(s,60);
 const late=engine.interact(at(s,LEVEL.burner),{type:"extinguish",holdAfter:true});
 assert.equal(late.failed,true);assert.equal(late.fireActive,true);
 assert.equal(late.interactions,s.interactions);assert.equal(late.failureReason,"fire_timeout");
 assert.equal(engine.updateEnvironment(late,5).fireElapsed,60);
});
test("reset restores full fire allowance and no failure reason",()=>{
 const s=engine.createInitialState();
 assert.equal(s.fireElapsed,0);assert.equal(s.failed,false);assert.equal(s.failureReason,null);
});
