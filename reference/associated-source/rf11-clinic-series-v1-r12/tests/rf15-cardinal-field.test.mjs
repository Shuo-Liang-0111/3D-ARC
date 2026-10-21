import test from "node:test";
import assert from "node:assert/strict";
import { createVariantEngine } from "../game/levels/rf15/variant-engine.js";
import { LEVEL as BASE } from "../game/levels/rf15/level.js";
import { FIELD, FIELD_CROPS, SHARED_PRODUCE } from "../game/levels/rf15/field-layout.js";

const level = variant => ({ ...BASE, variant, bounds: { ...BASE.bounds, maxX: 16.2, minZ: -15.2 }, intake: FIELD.basket, progress: { ...BASE.progress, movementPerMeter: .35, milestoneReward: 1 } });
const engine = createVariantEngine(level("rf15-2"));
function walk(state, x, z) {
  for (let frame = 0; frame < 3000; frame++) {
    const dx = x - state.player.x, dz = z - state.player.z;
    const length = Math.hypot(dx, dz);
    if (length < .025) return state;
    const step = Math.min(1, length / (BASE.moveSpeed * .05));
    const yaw = state.player.yaw;
    state = engine.updateMovement(state, { move: step * (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / length, strafe: step * (Math.cos(yaw) * dx - Math.sin(yaw) * dz) / length }, .05);
    assert.equal(state.failed, false, JSON.stringify({ target: [x,z], distance: state.distanceMoved, progress: state.progress, harvested: state.harvested }));
  }
  assert.fail(`Blocked at ${JSON.stringify(state.player)}, target ${x},${z}`);
}
function route(state, points) { for (const point of points) state = walk(state, ...point); return state; }
function interact(state, expected) { assert.equal(engine.getInteraction(state)?.type, expected); return engine.interact(state); }
function wait(state) { for (let frame = 0; frame < 20; frame++) state = engine.updateEnvironment(state, .05); return state; }

test("shared field: every visible crop requires a knife and all variants share initial objects", () => {
  const initial = ["rf15-1", "rf15-2", "rf15-3"].map(variant => createVariantEngine(level(variant)).createInitialState());
  assert.deepEqual(initial[0], initial[1]); assert.deepEqual(initial[1], initial[2]);
  let state = initial[0];
  state.player = { ...state.player, x: 11.95, z: FIELD_CROPS[0].z };
  assert.equal(engine.getInteraction(state).type, "knife-required");
  const failed = engine.interact(state);
  assert.equal(failed.crops[FIELD_CROPS[0].id].location, "field");
  assert.equal(failed.progress, 95);
  state.heldTool = "hand-trowel";
  assert.equal(engine.getInteraction(state).type, "knife-required");
  assert.equal(engine.isWalkable(state, FIELD_CROPS[0].x, FIELD_CROPS[0].z), false);
  assert.equal(engine.isWalkable(state, 12.3, FIELD_CROPS[0].z), true);
});

test("continuous route: open room, take knife, cut all existing field plants, collect in adjacent basket", () => {
  let state = engine.createInitialState();
  state = route(state, [[2.8, 2.5], [2.8, -8.7], [-2.6, -8.7], [-2.6, -9.2]]);
  state = wait(interact(state, "open-tool-room"));
  state = route(state, [[-4, -9.2], [-4, -11.65], [-5.9, -11.95]]);
  state = interact(state, "take-tool");
  state = route(state, [[-4, -11.65], [-4, -9.2], [-2.6, -9.2], [2.8, -9.2], [2.8, 2.8], [10.2, 2.8]]);
  for (const crop of FIELD_CROPS) {
    const standX = crop.kind === "lettuce" ? 11.95 : 12.65;
    state = route(state, [[12.3, 2.8], [12.3, 1.65], [standX, 1.65], [standX, crop.z]]);
    assert.equal(engine.getInteraction(state).item, crop.id);
    state = wait(interact(state, "pickup-crop"));
    assert.equal(state.carriedCrop, crop.id);
    assert.equal(state.crops[crop.id].location, "carried");
    state = route(state, [[standX, 1.65], [12.3, 1.65], [12.3, 2.8], [10.2, 2.8]]);
    state = interact(state, "harvest-drop");
    assert.equal(state.crops[crop.id].location, "basket");
  }
  assert.equal(state.complete, true);
  assert.equal(state.errors, 0);
  assert.equal(state.harvested.length, 8);
  assert.ok(state.progress > 5 && state.progress < 65, String(state.progress));
  assert.deepEqual(engine.interact(state), state);
  assert.equal(engine.createInitialState().harvested.length, 0);
  console.log(JSON.stringify({ routeDistance: state.distanceMoved, reserve: state.progress, minimum: state.minimumReserve }));
});

test("shared stations remain interactive and weighing waits for five kilograms", () => {
  for (const variant of ["rf15-1", "rf15-2"]) {
    const runtime = createVariantEngine(level(variant));
    let state = runtime.createInitialState();
    for (const item of SHARED_PRODUCE) {
      state.player = { ...state.player, x: item.x, z: item.z + 1 };
      state = runtime.interact(state);
      state.player = { ...state.player, x: BASE.scale.x, z: BASE.scale.z + 1 };
      state = runtime.interact(state);
      state = runtime.updateEnvironment(state, .05);
      const rejected = runtime.interact(state);
      assert.equal(rejected.items[item.id].weighed, undefined);
      for (let frame = 0; frame < 200 && Math.abs(state.weight - 5) > .18; frame++) state = runtime.updateEnvironment(state, .05);
      state = runtime.interact(state);
      assert.equal(state.items[item.id].weighed, true);
      state = runtime.interact(state);
      state.player = { ...state.player, x: BASE.pack.x, z: BASE.pack.z + 1 };
      state = runtime.interact(state); state = runtime.interact(state); state = runtime.interact(state);
      state.player = { ...state.player, x: BASE.tail.x, z: BASE.tail.z + 1 };
      state = runtime.interact(state);
    }
    assert.equal(state.loaded.length, 2);
    assert.equal(state.complete, false);
  }
});
