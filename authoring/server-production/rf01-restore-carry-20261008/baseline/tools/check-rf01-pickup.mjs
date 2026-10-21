import assert from "node:assert/strict";
import * as THREE from "three";
import { loadUnitreeG1Dex1Model, updateUnitreeG1Dex1Model, setUnitreeG1Dex1JointAngle, setUnitreeG1Dex1Grip } from "../game/unitree-g1-dex1-model.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const release = process.argv[2];
const manifest = release ? JSON.parse(await readFile(resolve(release, ".vite/manifest.json"), "utf8")) : null;
const runtime = await import(release ? pathToFileURL(resolve(release, manifest["game/levels/rf01-3/runtime.js"].file)) : "../game/levels/rf01-3/runtime.js");
import { PARCEL_META, SORTING } from "../game/rf01-sorting-layout.js";
globalThis.ProgressEvent = class { constructor(type, fields) { Object.assign(this, fields); } };
const model = await loadUnitreeG1Dex1Model({ url: "http://127.0.0.1:4173/local-assets/unitree/g1/g1_29dof_official.glb", groundY: 0 });
const robot = new THREE.Group(); robot.add(model);
robot.userData = { officialModel: model, robotId: "g1", robotProfile: { setJointAngle: setUnitreeG1Dex1JointAngle, setGrip: setUnitreeG1Dex1Grip }, rackPayload: new THREE.Group() };
const box = (dimensions) => { const root = new THREE.Group(); const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions)); mesh.position.y = dimensions[1]/2; root.add(mesh); return root; };
const scene = new THREE.Scene();
const world = { scene, battery: box([.44,.1833,.22]), sorting: { parcels: Object.fromEntries(Object.entries(PARCEL_META).map(([type, meta]) => [type, box(meta.dimensions)])) } };
scene.add(robot, world.battery, ...Object.values(world.sorting.parcels));
let state = runtime.createInitialState();
const controller = runtime.createInteractionAnimation(world, robot, { runtime, getState:()=>state, setState:s=>{state=s;}, stop(){}, message:message=>{throw Error(message);} });
function sync() {
  world.battery.visible=state.battery.location!=="carried";
  if(world.battery.visible) { world.battery.position.set(state.battery.x,state.battery.location==="slotted"?.38:Math.hypot(state.battery.x-runtime.LEVEL.batteryStart.x,state.battery.z-runtime.LEVEL.batteryStart.z)<.05?.46:0,state.battery.z);world.battery.rotation.y=state.battery.location==="slotted"?Math.PI:0; }
  for(const [type,object] of Object.entries(world.sorting.parcels)){const p=state.parcels[type];object.position.set(p.x,p.location==="conveyor"?SORTING.conveyor.beltHeight:p.location==="sorted"?SORTING.bins[type].floor:.045,p.z);object.rotation.y=0;}
}
function step() {
  state=runtime.updateMovement(state,controller.busy?controller.motionInput(state):{},.05);
  state=runtime.updateEnvironment(state,.05);
  robot.position.set(state.player.x,0,state.player.z);robot.rotation.set(0,state.player.yaw,0);
  updateUnitreeG1Dex1Model(model,.05,state.elapsed, "idle");
  sync(); controller.frame(.05,true);
}
function run(name) {
  sync(); step();
  const selected = runtime.getInteraction(state), beforeContacts = controller.contacts.length;
  const before = structuredClone(state);
  assert.equal(controller.interact(), true, name + " starts");
  assert.equal(controller.busy, true, name + " has a complete action");
  assert.deepEqual(state.battery, before.battery, "no immediate battery transfer");
  assert.equal(state.carriedItem, before.carriedItem, "no immediate parcel transfer");
  const phases = new Set(); let committed = false; let maxJump = 0;
  let previousCenter = null, sawPendingCompletion = false;
  for (let i = 0; i < 620; i++) {
    step();
    phases.add(controller.action?.phase ?? "idle");
    if (controller.contacts.length > beforeContacts) committed = true;
    if (controller.held) {
      const center = controller.held.center.clone();
      if (previousCenter) maxJump = Math.max(maxJump, center.distanceTo(previousCenter));
      previousCenter = center;
    }
    if (state.cargoActionPending) { sawPendingCompletion = true; assert.equal(state.complete, false); }
    if (!controller.busy) break;
  }
  assert.equal(controller.busy, false, name + " releases controls");
  assert.equal(committed, true, name + " reaches actual contact");
  assert.ok(phases.has("reach") && phases.has("prepare"), name + " has preparation and reach");
  assert.ok(maxJump < .16, name + " does not teleport a held object");
  assert.ok(controller.contacts.at(-1).contactErrors.every(error => error < .045), name + " both palms touch");
  if (state.battery.location === "carried" || state.carriedItem) {
    const moved = runtime.updateMovement(state, {move:-1,strafe:0,turn:0,drain:false}, .1);
    assert.ok(Math.hypot(moved.player.x-state.player.x,moved.player.z-state.player.z)>.01,name + " can retreat carrying");
  }
  console.log(JSON.stringify({name,phases:[...phases],contact:controller.contacts.at(-1),maxJump,sawPendingCompletion}));
}

state.player={x:-6.8,z:.75,yaw:Math.PI};run("battery");
state.player={x:6.15,z:1.5,yaw:Math.PI};run("slot");
state.enteredWorkshop=true;state.lightsOn=true;state.player={x:.7,z:-4.35,yaw:Math.PI};run("parcel");

state.player={x:SORTING.bins.yellow.x,z:-4.0,yaw:0};run("sort");

for(const type of ["red","blue"]){
 controller.reset();state=runtime.createInitialState();state.powered=true;state.battery={location:"slotted",...runtime.LEVEL.powerSlot};state.enteredWorkshop=true;state.lightsOn=true;
 state.conveyorPhase=(2.2-Object.keys(PARCEL_META).indexOf(type)*1.6+4.8)%4.8;state=runtime.updateEnvironment(state,0);state.player={x:.7,z:-4.35,yaw:Math.PI};run(type+" parcel");
 if(type==="blue")for(const other of ["red","yellow"])state.parcels[other].location="sorted";
 state.player={x:SORTING.bins[type].x,z:-4.0,yaw:0};run(type+" sort");
 if(type==="blue")assert.equal(state.complete,true,"last parcel waits for recovery");
}

controller.reset();state=runtime.createInitialState();state.player={x:-6.8,z:.75,yaw:Math.PI};run("battery-again");state.player={x:0,z:2,yaw:Math.PI};run("drop");

run("ground-pickup");

controller.reset();state=runtime.createInitialState();sync();step();assert.equal(controller.held,null);assert.equal(controller.busy,false);assert.equal(world.battery.visible,true);console.log("Reset clears animation and held object");
