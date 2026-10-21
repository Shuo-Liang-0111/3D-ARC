import test from "node:test";
import assert from "node:assert/strict";
import { createParkEngine } from "../game/rf01-shared-engine.js";
import { levelFor } from "../game/rf01-shared-level.js";
import { SORTING, PARCEL_TYPES, PARCEL_META } from "../game/rf01-sorting-layout.js";

const engine = createParkEngine(levelFor("rf01-3"));
function active() {
  return { ...engine.createInitialState(), powered: true, lightsOn: true, enteredWorkshop: true, progress: 60,
    player: { x: .65, z: -3.95, yaw: Math.PI } };
}
function carrying(type = "red") {
  const state = active();
  state.carriedItem = "parcel-" + type;
  state.parcels[type].location = "carried";
  state.player = { x: SORTING.bins[type].x, z: -4.1, yaw: 0 };
  return state;
}

test("all three variants expose identical sorting objects, colliders and power dependency", () => {
  const reference = engine.createInitialState();
  for (const id of ["rf01", "rf01-2", "rf01-3"]) {
    const variant = createParkEngine(levelFor(id));
    assert.deepEqual(variant.createInitialState(), reference);
    assert.deepEqual(variant.getColliders(reference), engine.getColliders(reference));
    assert.deepEqual(variant.updateEnvironment(reference, .1).parcels, reference.parcels);
    const state = active();
    assert.notDeepEqual(variant.updateEnvironment(state, .1).parcels, state.parcels);
    state.lightsOn = false;
    assert.notDeepEqual(variant.updateEnvironment(state, .1).parcels, state.parcels);
    state.powered = false;
    assert.deepEqual(variant.updateEnvironment(state, .1).parcels, state.parcels);
  }
});

test("unpowered parcels and parcels behind the front wall cannot be taken", () => {
  const state = active();
  state.powered = false;
  const rejected = engine.interact(state);
  assert.equal(rejected.carriedItem, null);
  assert.equal(rejected.progress, 55);
  state.parcels.red = { type: "red", location: "sorted", ...SORTING.bins.red };
  state.player = { x: SORTING.bins.red.x, z: -.85, yaw: Math.PI };
  assert.notEqual(engine.getInteraction(state)?.type, "parcel");
});

test("powered belt visibly advances all waiting parcels while carried cargo stays off the belt", () => {
  let state = active();
  state.lightsOn = false;
  state.carriedItem = "parcel-yellow";
  state.parcels.yellow.location = "carried";
  const yellow = { ...state.parcels.yellow };
  const redStart = state.parcels.red.x;
  for (let frame = 0; frame < 10; frame += 1) state = engine.updateEnvironment(state, .05);
  assert.ok(Math.abs(state.parcels.red.x - redStart) > .3);
  for (let frame = 0; frame < 1000; frame += 1) {
    state = engine.updateEnvironment(state, .05);
    for (const type of ["red", "blue"]) {
      assert.ok(state.parcels[type].x >= SORTING.conveyor.minX);
      assert.ok(state.parcels[type].x <= SORTING.conveyor.maxX);
    }
    assert.deepEqual(state.parcels.yellow, yellow);
  }
  state.powered = false;
  assert.deepEqual(engine.updateEnvironment(state, .1).parcels, state.parcels);
});

test("wrong cage retains cargo and debits reserve; correct reward is once per parcel", () => {
  let state = carrying();
  state.player.x = SORTING.bins.yellow.x;
  state = engine.interact(state);
  assert.equal(state.lastEvent, "wrong_bin");
  assert.equal(state.progress, 55);
  assert.equal(state.carriedItem, "parcel-red");
  state.player.x = SORTING.bins.red.x;
  state = engine.interact(state);
  assert.equal(state.parcels.red.location, "sorted");
  assert.equal(state.progress, 58);
  state = engine.interact(state);
  assert.equal(state.carriedItem, "parcel-red");
  state = engine.interact(state);
  assert.equal(state.progress, 58);
});

test("unsafe drop is rejected; ground cargo becomes a collider and pickup removes it", () => {
  let state = carrying();
  state.player = { x: .65, z: -3.95, yaw: Math.PI };
  const blocked = engine.interact(state);
  assert.equal(blocked.carriedItem, "parcel-red");
  assert.equal(blocked.progress, 55);
  state.player = { x: 2.9, z: -3.4, yaw: 0 };
  state = engine.interact(state);
  assert.equal(state.parcels.red.location, "ground");
  assert.ok(engine.getColliders(state).some(rect => rect.id === "parcel-red"));
  state = engine.interact(state);
  assert.equal(state.carriedItem, "parcel-red");
  assert.ok(!engine.getColliders(state).some(rect => rect.id === "parcel-red"));
});

test("reserve settles atomically, caps rewards, freezes failure and resets all parcels", () => {
  let state = carrying();
  state.progress = .1;
  state = engine.interact(state);
  assert.equal(state.progress, 3.1);
  const capped = carrying(); capped.progress = 99;
  assert.equal(engine.interact(capped).progress, 100);
  const wrong = carrying(); wrong.progress = 4; wrong.player.x = SORTING.bins.blue.x;
  const failed = engine.interact(wrong);
  assert.equal(failed.failed, true);
  assert.equal(failed.carriedItem, wrong.carriedItem);
  assert.deepEqual(failed.parcels, wrong.parcels);
  assert.deepEqual(engine.updateEnvironment(failed, .1), failed);
  assert.deepEqual(engine.updateMovement(failed, { move: 1 }, .05), failed);
  assert.deepEqual(engine.interact(failed), failed);
  const reset = engine.createInitialState();
  assert.equal(reset.progress, 100);
  assert.deepEqual(reset.rewardedMilestones, {});
  assert.ok(PARCEL_TYPES.every(type => reset.parcels[type].location === "conveyor"));
});

test("only the third variant completes from sorting; success never refills reserve", () => {
  for (const id of ["rf01", "rf01-2", "rf01-3"]) {
    const variant = createParkEngine(levelFor(id));
    const state = carrying("blue");
    for (const type of ["red", "yellow"]) Object.assign(state.parcels[type], SORTING.bins[type], { location: "sorted" });
    const sorted = variant.interact(state);
    assert.equal(sorted.complete, id !== "rf01");
    assert.equal(sorted.progress, 63);
    if (sorted.complete) assert.deepEqual(variant.updateEnvironment(sorted, .1), sorted);
  }
});

test("walls, extended belt, compact infeed and cages block movement while the east aisle stays clear", () => {
  const state = active();
  for (const point of [[0,-5.5],[-3.55,-2.6],[4.6,-4]]) assert.equal(engine.isWalkable(state,...point),false);
  assert.equal(engine.isWalkable(state,-3.25,-5.5),false);
  assert.equal(engine.isWalkable(state,3.8,-5.5),true);
  const idle = engine.updateMovement(state, {}, .05);
  const turned = engine.updateMovement(state, {turn:1}, .05);
  assert.equal(idle.progress, state.progress);
  assert.equal(turned.progress, state.progress);
  const against = active(); against.player.z=-4.48;
  assert.ok(engine.updateMovement(against,{move:1},.05).progress<against.progress);
});

test("loaded sorting aisle tolerates actual-browser yaw and lateral positioning drift", () => {
  for (const yaw of [-.12, 0, .12]) {
    for (const aisleZ of [-4.2, -4.1, -4.0]) {
      let state = carrying();
      state.player = { x: .65, z: aisleZ, yaw };
      for (let frame = 0; frame < 160; frame += 1) {
        state = engine.updateMovement(state, { move: -Math.sin(yaw), strafe: -Math.cos(yaw) }, .02);
      }
      assert.ok(state.player.x < -3.5, JSON.stringify(state.player));
      assert.ok(state.progress > 50);
    }
  }
});

test("every parcel can be lifted from a natural belt-edge stance and carried back into the aisle", () => {
  for (const type of PARCEL_TYPES) {
    for (const stanceZ of [-3.95, -4.2, -4.4, -4.55]) {
      let state = active();
      state.player = { x: .6, z: stanceZ, yaw: Math.PI };
      for (const parcel of Object.values(state.parcels)) parcel.onBelt = false;
      Object.assign(state.parcels[type], { x: .6, onBelt: true });
      assert.equal(engine.isWalkable(state, .6, stanceZ), true);
      state = engine.interact(state);
      assert.equal(state.carriedItem, "parcel-" + type);
      assert.equal(state.progress, 60);
      for (let frame = 0; frame < 50; frame += 1) state = engine.updateMovement(state, { move: -1 }, .02);
      assert.ok(state.player.z > stanceZ + .5);
      assert.equal(state.failed, false);
    }
  }
});

test("height-aware parcel clearance never lets the robot body pass through the belt or tall equipment", () => {
  const state = carrying();
  state.player = { x: .6, z: -4.55, yaw: Math.PI };
  assert.equal(engine.isWalkable(state, .6, -4.55), true);
  assert.equal(engine.isWalkable(state, .6, -4.9), false);
  assert.equal(engine.isWalkable(state, -.95, -4.4), false);
  assert.equal(engine.isWalkable(state, SORTING.bins.red.x, SORTING.bins.red.z), false);
});

test("MuJoCo idle and turn-only residual motion cannot drain reserve", () => {
  const state = active();
  state.player = { x: .6, z: -4.48, yaw: Math.PI };
  const waiting = engine.updateMovement(state, { move: .15, strafe: .01, turn: .02, passiveMotion: true }, .05);
  assert.equal(waiting.progress, state.progress);
  const bumping = engine.updateMovement(state, { move: 1, drain: true }, .05);
  assert.ok(bumping.progress < state.progress);
});

test("compact conveyor feeds spaced parcels continuously without exposing queued items to pickup", () => {
  let state = active();
  const seen = new Set();
  for (let frame = 0; frame < 800; frame += 1) {
    state = engine.updateEnvironment(state, .025);
    const visible = Object.values(state.parcels).filter(parcel => parcel.onBelt).sort((first, second) => first.x - second.x);
    assert.ok(visible.length >= 2 && visible.length <= 3);
    for (const parcel of visible) seen.add(parcel.type);
    for (let index = 1; index < visible.length; index += 1) {
      const previous = visible[index - 1], current = visible[index];
      const gap = current.x - previous.x - (PARCEL_META[current.type].dimensions[0] + PARCEL_META[previous.type].dimensions[0]) / 2;
      assert.ok(gap >= 1, String(gap));
    }
    const action = engine.getInteraction(state);
    if (action?.type === "parcel") assert.equal(state.parcels[action.parcelType].onBelt, true);
  }
  assert.deepEqual([...seen].sort(), [...PARCEL_TYPES].sort());
  assert.equal(SORTING.placements.some(placement => placement.asset === "compactInfeed"), true);
  assert.equal(SORTING.conveyor.length, 4.2);
});
