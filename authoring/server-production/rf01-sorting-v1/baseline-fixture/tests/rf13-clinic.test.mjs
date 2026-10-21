import test from "node:test";
import assert from "node:assert/strict";
import { LEVEL, STATIONS, SUPPLIES, PREPARATIONS, STATIC_BOXES, REVISION } from "../game/levels/rf13/level.js";
import { createInitialState, getInteraction, interact, isWalkable, updateMovement, canReach, isReady } from "../game/levels/rf13/engine.js";
import { readFileSync } from "node:fs";
import { walkRoute } from "../game/levels/rf13/review-route.js";

test("complete route uses real movement without teleporting or disabling collision", () => {
  let final;
  let interactions = 0;
  for (const entry of walkRoute()) {
    final = entry.state;
    if (entry.action === "interact") interactions += 1;
  }
  assert.equal(final.complete, true);
  assert.equal(interactions, 20);
  assert.equal(final.returned.length, 4);
  assert.equal(final.prepared.length, 2);
});

function face(state, point, x, z) {
  state.player = { x, z, yaw: Math.atan2(point.x - x, point.z - z) };
  assert.ok(isWalkable(state, x, z), `blocked interaction stance: ${x},${z}`);
}
test("correct delivery and empty-box return, preparations and two-step confirmation", () => {
  let state = createInitialState();
  face(state, LEVEL.terminal, LEVEL.terminal.x, LEVEL.terminal.z + 0.95);
  state = interact(state);
  assert.equal(state.lastEvent, "terminal_not_ready");
  for (const station of STATIONS) {
    const source = SUPPLIES.find(item => item.id === station.item);
    face(state, source, source.x + 0.95, source.z);
    assert.equal(getInteraction(state)?.item, source.id);
    state = interact(state);
    const wrong = STATIONS.find(entry => entry.id !== station.id);
    face(state, wrong, wrong.x, wrong.z + 0.95);
    assert.equal(interact(state).lastEvent, "wrong_station");
    face(state, station, station.x, station.z + 0.95);
    state = interact(state);
    assert.ok(state.delivered.includes(station.id));
    const empty = state.items[`empty-${station.id}`];
    face(state, empty, empty.x, empty.z + 0.95);
    state = interact(state);
    assert.equal(state.carriedItem, empty.id);
    face(state, LEVEL.returns, LEVEL.returns.x, LEVEL.returns.z + 0.95);
    state = interact(state);
    assert.ok(state.returned.includes(empty.id));
  }
  for (const preparation of PREPARATIONS) {
    face(state, preparation, preparation.x, preparation.z + 0.95);
    state = interact(state);
    assert.ok(state.prepared.includes(preparation.id));
    assert.ok(isWalkable(state, preparation.x, preparation.z));
    assert.equal(isWalkable(state, preparation.destination.x, preparation.destination.z), false);
  }
  assert.equal(isReady(state), true);
  face(state, LEVEL.terminal, LEVEL.terminal.x, LEVEL.terminal.z + 0.95);
  state = interact(state);
  assert.equal(state.terminalOpen, true);
  state = interact(state);
  assert.equal(state.complete, true);
  assert.deepEqual(interact(state), state);
  assert.equal(createInitialState().delivered.length, 0);
});
test("drop and recollect restores floor collision and preserves item identity", () => {
  let state = createInitialState();
  const item = SUPPLIES[0];
  face(state, item, item.x + 0.95, item.z);
  state = interact(state);
  state.player = { x: -2, z: 2.0, yaw: Math.PI };
  state = interact(state);
  assert.equal(state.items.gloves.location, "floor");
  assert.equal(isWalkable(state, -2, 1.05), false);
  state = interact(state);
  assert.equal(state.carriedItem, "gloves");
  assert.equal(isWalkable(state, -2, 1.05), true);
});
test("walls block interaction and travel, doorways pass with shared envelope", () => {
  const state = createInitialState();
  state.player = { x: -3.9, z: -2.6, yaw: Math.PI / 2 };
  assert.equal(canReach(state, { x: -3.1, z: -2.6 }), false);
  for (const center of [-5.25, -1.75, 1.75, 5.25]) {
    for (const carrying of [false, true]) {
      let moving = createInitialState();
      moving.player = { x: center, z: -0.2, yaw: Math.PI };
      if (carrying) { moving.carriedItem = "gloves"; moving.items.gloves.location = "carried"; }
      for (let frame = 0; frame < 30; frame += 1) moving = updateMovement(moving, { move: 1, drain: false }, 0.05);
      assert.ok(moving.player.z < -1.7, `doorway blocked at ${center}`);
    }
  }
  let moving = createInitialState();
  moving.player = { x: -3.9, z: -2.6, yaw: Math.PI / 2 };
  for (let frame = 0; frame < 80; frame += 1) moving = updateMovement(moving, { move: 1 }, 0.05);
  assert.ok(moving.player.x < -3.8);
  moving.progress = 0.001;
  moving = updateMovement(moving, { move: 1 }, 0.05);
  assert.equal(moving.failed, true);
});
test("Blender collision bounds match runtime source and exports are actual GLB", () => {
  const root = `public/local-assets/levels/rf13/${REVISION}/`;
  for (const name of ["environment", "collision", "gloves", "gauze", "dressings", "forms", "empty-box", "chair", "trolley"]) {
    const binary = readFileSync(root + name + ".glb");
    assert.equal(binary.toString("utf8", 0, 4), "glTF");
    assert.equal(binary.readUInt32LE(4), 2);
    assert.equal(binary.readUInt32LE(8), binary.length);
  }
  const binary = readFileSync(root + "collision.glb");
  const document = JSON.parse(binary.toString("utf8", 20, 20 + binary.readUInt32LE(12)));
  const nodes = document.nodes.filter(node => node.name?.startsWith("COLLIDER_"));
  assert.equal(nodes.length, STATIC_BOXES.length);
  assert.ok(nodes.every(node => node.extras.collision === true));
  for (const box of STATIC_BOXES) {
    const node = nodes.find(node => node.name === "COLLIDER_" + box.id);
    assert.ok(node);
    const position = node.translation || [0, 0, 0];
    position.forEach((value, index) => assert.ok(Math.abs(value - box.position[index]) < 0.00001));
    const primitive = document.meshes[node.mesh].primitives[0];
    const accessor = document.accessors[primitive.attributes.POSITION];
    box.size.forEach((size, index) => assert.ok(Math.abs(accessor.max[index] - accessor.min[index] - size) < 0.00001));
  }
});
