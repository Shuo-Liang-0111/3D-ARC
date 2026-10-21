import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createParkEngine } from "../game/rf01-shared-engine.js";
import { levelFor, WORKSHOP } from "../game/rf01-shared-level.js";
import { syncVisuals } from "../game/rf01-shared-scene.js";

function at(state, target, zOffset = 1.1) {
  return { ...state, player: { x: target.x, z: target.z + zOffset, yaw: zOffset > 0 ? Math.PI : 0 } };
}
function connectBattery(engine, level, state) {
  state = engine.interact(at(state, level.batteryStart));
  assert.equal(state.battery.location, "carried");
  state = engine.interact(at(state, level.powerSlot));
  assert.equal(state.powered, true);
  assert.equal(state.battery.location, "slotted");
  return state;
}
for (const id of ["rf01-2", "rf01-3"]) {
  test(id + " requires connected battery for both workshop controls", () => {
    const level = levelFor(id), engine = createParkEngine(level);
    let state = engine.createInitialState();
    for (const [control, offset] of [[WORKSHOP.doorControl, 1.1], [WORKSHOP.innerDoorControl, -1.1]]) {
      const attempt = at(state, control, offset);
      assert.equal(engine.getInteraction(attempt)?.type, "shutter");
      const rejected = engine.interact(attempt);
      assert.equal(rejected.shutterRequested, false);
      assert.equal(rejected.shutterPhase, "closed");
      assert.equal(rejected.rewardedMilestones.shutter, undefined);
      assert.equal(engine.updateEnvironment(rejected, .1).shutterLift, 0);
    }
    const held = engine.interact(at(state, level.batteryStart));
    assert.equal(held.battery.location, "carried");
    assert.equal(engine.interact(at(held, WORKSHOP.doorControl)).shutterPhase, "closed");
    state = connectBattery(engine, level, state);
    for (const [control, offset] of [[WORKSHOP.doorControl, 1.1], [WORKSHOP.innerDoorControl, -1.1]]) {
      let opened = engine.interact(at(state, control, offset));
      assert.equal(opened.shutterPhase, "opening");
      for (let i = 0; i < 32; i++) opened = engine.updateEnvironment(opened, .1);
      assert.equal(opened.shutterLift, WORKSHOP.height);
      assert.equal(engine.isWalkable(opened, 1.6, -1.4), true);
    }
    assert.equal(engine.interact(at(engine.createInitialState(), WORKSHOP.doorControl)).shutterPhase, "closed");
  });
}
test("RF-01 keeps its existing unpowered workshop-door behavior", () => {
  const engine = createParkEngine(levelFor("rf01"));
  assert.equal(engine.interact(at(engine.createInitialState(), WORKSHOP.doorControl)).shutterPhase, "opening");
});

function visualWorld(state) {
  const material = () => new THREE.MeshStandardMaterial();
  return {
    doorPanel: new THREE.Group(), doorOpenX: 2, doorClosedX: 0,
    doorLampMaterial: material(), slotGlowMaterial: material(), terminalScreenMaterial: material(),
    exitMaterial: material(), beacon: { intensity: 0 }, battery: new THREE.Group(),
    crates: state.crates.map(() => new THREE.Group()),
    sorting: {
      indicatorMaterial: material(), beltTexture: { offset: { x: 0 } }, rollers: [], rollerRadius: .075,
      parcels: Object.fromEntries(Object.keys(state.parcels).map(type => [type, new THREE.Group()])),
    },
  };
}
test("actual shared scene sync hides indoor parcels until lighting and preserves exterior boxes", () => {
  const engine = createParkEngine(levelFor("rf01-3"));
  let state = engine.createInitialState(), world = visualWorld(state);
  const positions = structuredClone(state.parcels);
  for (const powered of [false, true]) {
    state.powered = powered;
    syncVisuals(world, state, 0);
    assert.ok(Object.values(world.sorting.parcels).every(model => !model.visible));
    assert.ok(world.crates.every(model => model.visible));
  }
  state.enteredWorkshop = true;
  state = engine.interact(at(state, WORKSHOP.lightSwitch, .88));
  assert.equal(state.lightsOn, true);
  syncVisuals(world, state, 0);
  assert.ok(Object.values(world.sorting.parcels).some(model => model.visible));
  for (const [type, parcel] of Object.entries(state.parcels)) {
    assert.equal(world.sorting.parcels[type].visible, parcel.onBelt !== false);
  }
  assert.deepEqual(state.parcels, positions);
  state = engine.interact(state);
  assert.equal(state.lightsOn, false);
  syncVisuals(world, state, 0);
  assert.ok(Object.values(world.sorting.parcels).every(model => !model.visible));
  const types = Object.keys(state.parcels);
  state.parcels[types[0]] = { ...state.parcels[types[0]], location: "ground", x: 3, z: 2 };
  state.parcels[types[1]].location = "carried";
  state.parcels[types[2]].location = "sorted";
  state.lightsOn = true;
  syncVisuals(world, state, 0);
  assert.equal(world.sorting.parcels[types[0]].visible, true);
  assert.equal(world.sorting.parcels[types[1]].visible, false);
  assert.equal(world.sorting.parcels[types[2]].visible, true);
  state.lightsOn = false;
  syncVisuals(world, state, 0);
  assert.equal(world.sorting.parcels[types[0]].visible, true);
  assert.equal(world.sorting.parcels[types[2]].visible, false);
  state = engine.createInitialState();
  syncVisuals(world, state, 0);
  assert.ok(Object.values(world.sorting.parcels).every(model => !model.visible));
});

test("hidden indoor parcels cannot be targeted; lighting restores existing pickup", () => {
  const engine = createParkEngine(levelFor("rf01-3"));
  let state = engine.createInitialState();
  state.powered = true; state.enteredWorkshop = true;
  for (const parcel of Object.values(state.parcels)) parcel.onBelt = false;
  const type = Object.keys(state.parcels)[0];
  Object.assign(state.parcels[type], { x: .6, onBelt: true });
  state.player = { x: .6, z: -4.2, yaw: Math.PI };
  assert.notEqual(engine.getInteraction(state)?.type, "parcel");
  assert.equal(engine.interact(state).carriedItem, null);
  state.lightsOn = true;
  assert.equal(engine.getInteraction(state)?.type, "parcel");
  assert.equal(engine.interact(state).carriedItem, "parcel-" + type);
});
