import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { LEVEL, BALLS, STATIC_COLLIDERS, STRUCTURES } from "../game/levels/rf14/level.js";
import { LEVEL as SHARED_LEVEL } from "../game/level.js";
import { createInitialState, updateMovement, isWalkable, canReach, getInteraction, interact } from "../game/levels/rf14/engine.js";

function walk(state, x, z) {
  let next = state;
  for (let frame = 0; frame < 5000; frame += 1) {
    const offsetX = x - next.player.x;
    const offsetZ = z - next.player.z;
    if (Math.hypot(offsetX, offsetZ) < 0.055) return next;
    next = updateMovement(next, { x: offsetX, z: offsetZ }, 0.025);
    assert.ok(isWalkable(next, next.player.x, next.player.z), 'continuous route remains walkable');
  }
  assert.fail(`Route blocked approaching ${x},${z} from ${JSON.stringify(next.player)}`);
}
function face(state, yaw) {
  let next = state;
  for (let frame = 0; frame < 250; frame += 1) {
    const angle = Math.atan2(Math.sin(yaw - next.player.yaw), Math.cos(yaw - next.player.yaw));
    if (Math.abs(angle) < 0.02) return next;
    next = updateMovement(next, { move: 0, turn: Math.sign(angle) }, Math.min(0.01, Math.abs(angle) / LEVEL.turnSpeed));
  }
  assert.fail('Could not turn within shared envelope');
}

test('tennis preserves shared robot dimensions and locomotion', () => {
  for (const property of ['playerRadius', 'playerForwardOffset', 'moveSpeed', 'turnSpeed']) assert.equal(LEVEL[property], SHARED_LEVEL[property]);
  assert.equal(BALLS.length, 8);
  assert.equal(new Set(BALLS.map(ball => ball.id)).size, 8);
  assert.ok(LEVEL.progress.actionDrainPerSecond > 0);
  assert.ok(LEVEL.progress.invalidInteractionDrain > 0);
});
test('invalid interaction consumes reserve and can fail the task', () => {
  let state = createInitialState();
  const before = state.progress;
  state = interact(state);
  assert.equal(state.progress, before - LEVEL.progress.invalidInteractionDrain);
  state.progress = LEVEL.progress.invalidInteractionDrain;
  state = interact(state);
  assert.equal(state.failed, true);
  assert.equal(state.lastEvent, 'progress_depleted');
});
test('entrance and both net run-around corridors are open', () => {
  const state = createInitialState();
  for (const point of [[0, 19.9], [0, 19], [0, 17], [-8.9, 0], [7.3, 0], [8.7, 12]]) assert.ok(isWalkable(state, ...point));
  for (const point of [[0, 0], [-6.4, 0], [6.4, 0], [8.2, 8], [8.5, 4.5], [10, 5], [0, -19], [-7.35, 0]]) assert.equal(isWalkable(state, ...point), false);
  let carried = createInitialState();
  carried.player = { x: -8.9, z: 2, yaw: Math.PI };
  carried.carriedItem = 'ball-1';
  carried.items['ball-1'].location = 'carried';
  carried = walk(carried, -8.9, -2);
  carried = face(carried, 0);
  carried = walk(carried, -8.9, 2);
  assert.equal(carried.carriedItem, 'ball-1');
});
test('pickup requires proximity and facing, and cannot reach across net', () => {
  let state = createInitialState();
  assert.equal(getInteraction(state), null);
  state.player = { x: -3.8, z: 10.8, yaw: 0 };
  assert.equal(getInteraction(state), null);
  state.player.yaw = Math.PI;
  assert.equal(getInteraction(state).item, 'ball-1');
  state.player = { x: 0, z: 0.55, yaw: Math.PI };
  assert.equal(canReach(state, { x: 0, z: -0.4 }), false);
});
test('complete movement route collects every ball and tolerates a dropped ball', () => {
  let state = createInitialState();
  state = walk(state, 0, 12);
  for (const ball of BALLS) {
    if (state.player.z < 0 && ball.z > 0) {
      state = walk(state, 7.3, state.player.z);
      state = walk(state, 7.3, 2);
    }
    if (state.player.z > 0 && ball.z < 0) {
      state = walk(state, 7.3, 8);
      state = walk(state, 7.3, -2);
    }
    state = walk(state, ball.x, ball.z + 0.8);
    state = face(state, Math.PI);
    assert.equal(getInteraction(state)?.item, ball.id);
    state = interact(state);
    assert.equal(state.carriedItem, ball.id);
    if (ball.id === 'ball-1') {
      state = interact(state);
      assert.equal(state.carriedItem, null);
      state = interact(state);
      assert.equal(state.carriedItem, ball.id);
    }
    state = walk(state, 7.3, ball.z + 0.8);
    if (ball.z < 0) state = walk(state, 7.3, 2);
    state = walk(state, 7.3, 8);
    state = face(state, Math.PI / 2);
    assert.equal(getInteraction(state)?.type, 'deliver');
    state = interact(state);
    assert.ok(state.delivered.includes(ball.id));
    assert.equal(state.carriedItem, null);
  }
  assert.ok(state.complete);
  assert.equal(state.delivered.length, 8);
  assert.ok(state.progress >= 15 && state.progress <= 25);
  assert.deepEqual(interact(state), state);
  const reset = createInitialState();
  assert.equal(reset.delivered.length, 0);
  assert.equal(Object.values(reset.items).filter(item => item.location === 'floor').length, 8);
  console.log(JSON.stringify({ routeSeconds: Number(state.elapsed.toFixed(2)), interactions: state.interactions, delivered: state.delivered.length, minimumReserve: 100 }));
});
test('moving into net and fence does not tunnel with large delta', () => {
  let state = createInitialState();
  state.player = { x: 0, z: 1, yaw: Math.PI };
  for (let frame = 0; frame < 100; frame += 1) state = updateMovement(state, { move: 1 }, 99);
  assert.ok(state.player.z > 0.5);
  state.player = { x: 9.2, z: 10, yaw: Math.PI / 2 };
  for (let frame = 0; frame < 100; frame += 1) state = updateMovement(state, { move: 1 }, 99);
  assert.ok(state.player.x < 9.5);
});
test('current asset revision contains complete GLB files and collider metadata', () => {
  const assetRoot = new URL(`../public/local-assets/levels/rf14/${LEVEL.revision}/`, import.meta.url);
  for (const name of ['environment', 'collision', 'ball', 'cart']) {
    const path = new URL(`${name}.glb`, assetRoot);
    assert.ok(existsSync(path));
    const bytes = readFileSync(path);
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const document = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    assert.ok(document.meshes.length > 0);
    if (name === 'collision') {
      const colliders = document.nodes.filter(node => node.extras?.collision).map(node => node.name).sort();
      assert.deepEqual(colliders, [...STRUCTURES.map(structure => `COLLIDER_${structure.id}`), 'COLLIDER_floor'].sort());
    }
    if (name === 'environment' || name === 'ball') assert.ok(document.images?.length > 0);
  }
  assert.equal(STATIC_COLLIDERS.length, STRUCTURES.length);
});
