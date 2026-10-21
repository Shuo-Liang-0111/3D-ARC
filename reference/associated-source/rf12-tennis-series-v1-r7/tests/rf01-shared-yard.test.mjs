import test from "node:test";
import assert from "node:assert/strict";
import { createParkEngine } from "../game/rf01-shared-engine.js";
import { levelFor, WORKSHOP, DISPATCH, DYNAMIC_DEVICE } from "../game/rf01-shared-level.js";

export function routeHarness(id) {
  const level = levelFor(id), engine = createParkEngine(level);
  let state = engine.createInitialState();
  function tick(input, duration=.02) {
    state = engine.updateMovement(state,input,duration);
    state = engine.updateEnvironment(state,duration);
    assert.equal(state.failed,false,"depleted at "+JSON.stringify(state.player));
  }
  function walk(x,z) {
    for(let frame=0;frame<5000;frame+=1){
      const dx=x-state.player.x,dz=z-state.player.z,remaining=Math.hypot(dx,dz),yaw=state.player.yaw;
      if(remaining<.025)return;
      tick({move:(dx*Math.sin(yaw)+dz*Math.cos(yaw))/remaining,strafe:(dx*Math.cos(yaw)-dz*Math.sin(yaw))/remaining},Math.min(.02,remaining/level.moveSpeed));
      if(state.complete) return;
    }
    assert.fail("blocked "+JSON.stringify(state.player)+" target "+x+","+z);
  }
  function face(yaw) {
    for(let frame=0;frame<400;frame+=1){
      const delta=Math.atan2(Math.sin(yaw-state.player.yaw),Math.cos(yaw-state.player.yaw));
      if(Math.abs(delta)<.015)return;
      tick({turn:Math.sign(delta)},Math.min(.02,Math.abs(delta)/level.turnSpeed));
    }
    assert.fail("rotation blocked "+JSON.stringify(state.player));
  }
  function act(type) {
    assert.equal(engine.getInteraction(state)?.type,type,"interaction at "+JSON.stringify(state.player));
    state=engine.interact(state); assert.equal(state.failed,false);
  }
  function waitOpen() { for(let frame=0;frame<200&&state.shutterLift<WORKSHOP.clearance;frame+=1)tick({}); assert.ok(state.shutterLift>=WORKSHOP.clearance); }
  function shutter() {
    if(state.shutterPhase === "open" && state.shutterHold < 6) {
      for(let frame=0;frame<600 && state.shutterPhase === "open";frame+=1) tick({});
    }
    if(["closed","closing"].includes(state.shutterPhase)) act("shutter");
    waitOpen();
  }
  function supply() {
    walk(-6.8,1.25); face(Math.PI);act("battery");
    walk(-6.8,2.1);walk(6.15,2.1);act("slot");
  }
  function enter() {
    walk(-.68,0);face(Math.PI);shutter();
    walk(1.6,0);walk(1.6,-3.1);
  }
  function light() { walk(3.8,-3.1);walk(3.8,-5.5);face(Math.PI);act("lights"); }
  function ship(index) {
    walk(1.6,-3.1);walk(-1.9,-3.1);
    const crate=state.crates[index];walk(-2.35,crate.z);face(-Math.PI/2);act("crate");
    face(0);walk(-.68,-3.3);shutter();walk(1.6,-3.3);walk(1.6,.15);
    walk(1.8,DISPATCH.bays[index].z);face(Math.PI/2);act("deliver");
  }
  return { engine,level,tick,walk,face,act,enter,light,supply,ship,actInvalid:()=>{state=engine.interact(state);},get state(){return state;} };
}
test("all RF-01 variants share initial objects, collision and mechanics",()=>{
  const variants=["rf01","rf01-2","rf01-3"].map(id=>({level:levelFor(id),engine:createParkEngine(levelFor(id))}));
  for(const variant of variants.slice(1)){
    assert.deepEqual(variant.engine.createInitialState(),variants[0].engine.createInitialState());
    assert.deepEqual(variant.level.staticColliders,variants[0].level.staticColliders);
    assert.deepEqual(variant.level.progress,variants[0].level.progress);
  }
});
test("RF-01-3 moves the inspection trolley until the control box requests a stop",()=>{
  const engine=createParkEngine(levelFor("rf01-3"));
  let state=engine.createInitialState();
  assert.equal(state.dynamic.phase,"moving");
  const startX=state.dynamic.x;
  state=engine.updateEnvironment(state,1);
  assert.ok(state.dynamic.x>startX);
  state.player={x:DYNAMIC_DEVICE.control.x-.7,z:DYNAMIC_DEVICE.control.z,yaw:Math.PI/2};
  assert.equal(engine.getInteraction(state)?.type,"dynamic-control");
  state=engine.interact(state);
  assert.equal(state.dynamic.stopRequested,true);
  assert.equal(state.dynamic.phase,"moving");
  for(let frame=0;frame<100 && state.dynamic.phase!=="stopped";frame+=1) state=engine.updateEnvironment(state,.1);
  assert.equal(state.dynamic.x,DYNAMIC_DEVICE.trackMaxX);
  assert.equal(state.dynamic.phase,"stopped");
  assert.equal(state.dynamic.arm,"raising");
  for(let frame=0;frame<10 && state.dynamic.arm!=="raised";frame+=1) state=engine.updateEnvironment(state,.1);
  assert.equal(state.dynamic.arm,"raised");
});
test("RF-01-3 keeps the moving trolley and raised safety arm collidable",()=>{
  const engine=createParkEngine(levelFor("rf01-3"));
  let state=engine.createInitialState();
  const trolley=engine.getColliders(state).find(rect=>rect.id==="rf01-3-trolley");
  assert.ok(trolley);
  assert.equal(engine.isWalkable(state,state.dynamic.x,state.dynamic.z),false);
  state.dynamic.phase="stopped";state.dynamic.arm="raised";
  const arm=engine.getColliders(state).find(rect=>rect.id==="rf01-3-safety-arm");
  assert.ok(arm);
  assert.equal(engine.isWalkable(state,(arm.minX+arm.maxX)/2,(arm.minZ+arm.maxZ)/2),false);
});
test("RF-01-3 completes only after the stopped trolley is safety locked",()=>{
  const engine=createParkEngine(levelFor("rf01-3"));
  let state=engine.createInitialState();
  state.player={x:DYNAMIC_DEVICE.lock.x-.7,z:DYNAMIC_DEVICE.lock.z,yaw:Math.PI/2};
  state.dynamic.stopRequested=true;state.dynamic.phase="stopped";state.dynamic.x=DYNAMIC_DEVICE.trackMaxX;state.dynamic.arm="raised";
  assert.equal(engine.getInteraction(state)?.type,"dynamic-lock");
  state=engine.interact(state);
  assert.equal(state.dynamic.locked,true);
  assert.equal(state.dynamic.phase,"locked");
  assert.equal(state.complete,true);
  const reset=engine.createInitialState();
  assert.equal(reset.dynamic.locked,false);
  assert.equal(reset.complete,false);
});
test("RF-01 can open its factory and light it without completing the power mission",()=>{
  const route=routeHarness("rf01");route.enter();route.light();
  assert.equal(route.state.lightsOn,true);assert.equal(route.state.complete,false);
});
test("RF-01-2 can collect the battery and restore power without completing lighting",()=>{
  const route=routeHarness("rf01-2");route.supply();
  assert.equal(route.state.powered,true);assert.equal(route.state.complete,false);
});
test("battery pickup keeps the robot mobile beside the rack",()=>{
  const engine=createParkEngine(levelFor("rf01-2"));
  let state=engine.createInitialState();
  state.player={x:-6.8,z:.65,yaw:Math.PI};
  assert.equal(engine.getInteraction(state)?.type,"battery");
  state=engine.interact(state);
  assert.equal(state.battery.location,"carried");
  const before=state.player.z;
  for(let frame=0;frame<20;frame+=1) state=engine.updateMovement(state,{move:-1},.02);
  assert.ok(state.player.z>before+.15);
  assert.equal(state.failed,false);
});
test("RF-01 power and exit route still completes",()=>{
  const route=routeHarness("rf01");route.supply();route.walk(0,5.3);route.face(0);route.act("door");route.walk(0,7.5);
  assert.equal(route.state.complete,true);
  console.log(JSON.stringify({route:"rf01",distance:route.state.distanceMoved,reserve:route.state.progress,minimum:route.state.minimumReserve}));
});
test("RF-01 shutter and light controls remain reachable from the physical approach boundary",()=>{
  const engine=createParkEngine(levelFor("rf01"));
  let state=engine.createInitialState();
  state.player={x:-.68,z:.33,yaw:Math.PI};
  state.powered=true;
  assert.equal(engine.getInteraction(state)?.type,"shutter");
  state.shutterLift=WORKSHOP.height;state.shutterPhase="open";state.enteredWorkshop=true;
  state.player={x:3.8,z:-5.05,yaw:Math.PI};
  assert.equal(engine.getInteraction(state)?.type,"lights");
});
test("shutter closes on a timer, protects bodies and held crates, and reopens inside",()=>{
  const engine=createParkEngine(levelFor("rf01"));
  let state=engine.createInitialState();
  state.player={x:-.68,z:0,yaw:Math.PI};state=engine.interact(state);
  for(let frame=0;frame<1000;frame+=1)state=engine.updateEnvironment(state,.02);
  assert.equal(state.shutterPhase,"closed");assert.equal(state.shutterLift,0);
  state.player={x:WORKSHOP.innerDoorControl.x,z:-2.9,yaw:0};state.enteredWorkshop=true;
  assert.equal(engine.getInteraction(state).type,"shutter");
  state=engine.interact(state);
  for(let frame=0;frame<160;frame+=1)state=engine.updateEnvironment(state,.02);
  state.shutterPhase="closing";state.player={x:1.6,z:-1.4,yaw:0};
  const lift=state.shutterLift;state=engine.updateEnvironment(state,.1);
  assert.equal(state.shutterLift,lift);assert.equal(state.shutterBlocked,true);
  state.player.z=-2.7;state.carriedItem="crate-0";state.crates[0].location="carried";
  state=engine.updateEnvironment(state,.1);
  assert.equal(state.shutterLift,lift);assert.equal(state.shutterBlocked,true);
  state.player.z=-3.3;state=engine.updateEnvironment(state,.1);assert.ok(state.shutterLift<lift);
});
test("the relocated interior control is reachable and reopens the shutter",()=>{
  const route=routeHarness("rf01");
  route.enter();route.walk(WORKSHOP.innerDoorControl.x,-2.9);route.face(0);
  for(let frame=0;frame<1000;frame+=1)route.tick({});
  assert.equal(route.state.shutterPhase,"closed");
  route.act("shutter");
  for(let frame=0;frame<170;frame+=1)route.tick({});
  assert.ok(route.state.shutterLift>=WORKSHOP.clearance);
});
test("RF-01-3 reaches both controls through a continuous workshop route",()=>{
  const route=routeHarness("rf01-3");
  route.enter();route.light();route.walk(3.8,-3.1);route.walk(-2.35,-3.1);
  route.face(Math.atan2(DYNAMIC_DEVICE.control.x-route.state.player.x,DYNAMIC_DEVICE.control.z-route.state.player.z));
  route.act("dynamic-control");
  for(let frame=0;frame<1300&&route.state.dynamic.arm!=="raised";frame+=1)route.tick({});
  assert.equal(route.state.dynamic.phase,"stopped");
  route.walk(4.05,-3.1);
  route.face(Math.atan2(DYNAMIC_DEVICE.lock.x-route.state.player.x,DYNAMIC_DEVICE.lock.z-route.state.player.z));
  route.act("dynamic-lock");
  assert.equal(route.state.complete,true);
  assert.ok(route.state.minimumReserve>0);
});
test("dynamic crate collision follows pickup, delivery and reset",()=>{
  const engine=createParkEngine(levelFor("rf01"));let state=engine.createInitialState();
  state.player={x:-2.35,z:-4.8,yaw:-Math.PI/2};
  assert.equal(engine.isWalkable(state,-3.55,-4.8),false);
  state=engine.interact(state);assert.equal(state.carriedItem,"crate-0");
  assert.equal(engine.getColliders(state).some(rect=>rect.id==="crate-0"),false);
  state.player={x:1.8,z:2.75,yaw:Math.PI/2};state=engine.interact(state);
  assert.equal(state.crates[0].location,"delivered");assert.equal(state.carriedItem,null);
  assert.equal(engine.isWalkable(state,3.25,2.75),false);
  assert.equal(engine.createInitialState().crates[0].location,"ground");
});
test("carried envelope blocks narrow clearance and unsafe crate drops",()=>{
  const engine=createParkEngine(levelFor("rf01"));let state=engine.createInitialState();
  state.player={x:1.6,z:-2.8,yaw:0};state.shutterLift=WORKSHOP.height;
  assert.equal(engine.isWalkable(state,1.6,-2.8),true);
  state.carriedItem="crate-0";state.crates[0].location="carried";state.shutterLift=0;
  assert.equal(engine.isWalkable(state,1.6,-2.8),false);
  const rejected=engine.interact(state);assert.equal(rejected.carriedItem,"crate-0");assert.equal(rejected.progress,95);
});
test("dispatch cannot complete early and delivery rewards cannot be repeated",()=>{
  const engine=createParkEngine(levelFor("rf01"));let state=engine.createInitialState();
  state.player={x:4.15,z:5.25,yaw:Math.atan2(.95,-1)};state=engine.interact(state);
  assert.equal(state.terminalOpen,true);assert.equal(state.complete,false);state=engine.closeTerminal(state);
  state.progress=50;state.player={x:1.8,z:2.75,yaw:Math.PI/2};state.carriedItem="crate-0";state.crates[0].location="carried";
  state=engine.interact(state);const progress=state.progress;
  state.player.x=2;state=engine.interact(state);assert.equal(state.carriedItem,"crate-0");
  state=engine.interact(state);assert.equal(state.progress,progress);
});
