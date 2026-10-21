from pathlib import Path
root = Path('.')
(root / 'tests/rf15-harvest.test.mjs').write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, updateMovement, interact, getInteraction, isWalkable } from "../game/levels/rf15/engine.js";
import { LEVEL } from "../game/levels/rf15/level.js";

function turn(state, yaw) {
  for (let frame = 0; frame < 200; frame += 1) {
    const delta = Math.atan2(Math.sin(yaw - state.player.yaw), Math.cos(yaw - state.player.yaw));
    if (Math.abs(delta) < 0.015) return state;
    state = updateMovement(state, { turn: Math.max(-1, Math.min(1, delta / (LEVEL.turnSpeed * 0.05))) }, 0.05);
  }
  throw Error('Turn blocked');
}
function walk(state, x, z) {
  for (let frame = 0; frame < 1800; frame += 1) {
    const deltaX = x - state.player.x;
    const deltaZ = z - state.player.z;
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance < 0.008) return state;
    const scale = Math.min(1, distance / (LEVEL.moveSpeed * 0.05)) / distance;
    const yaw = state.player.yaw;
    const before = state;
    state = updateMovement(state, { move: (Math.sin(yaw) * deltaX + Math.cos(yaw) * deltaZ) * scale, strafe: (Math.cos(yaw) * deltaX - Math.sin(yaw) * deltaZ) * scale }, 0.05);
    assert.equal(state.failed, false, `Reserve depleted toward ${x},${z}`);
    assert.ok(Math.hypot(state.player.x - before.player.x, state.player.z - before.player.z) > 0.000001, `Blocked at ${state.player.x},${state.player.z} toward ${x},${z}`);
  }
  throw Error('Route timed out');
}
function action(state, expected) { assert.equal(getInteraction(state)?.type, expected, JSON.stringify(state.player)); const next = interact(state); assert.equal(next.failed, false); assert.equal(next.errors, state.errors); return next; }
export function fullRoute(errors = 0) {
  let state = createInitialState();
  for (let count = 0; count < errors; count += 1) state = interact(state);
  for (const [id, startX] of [['tomato', -6.4], ['apple', -5.3]]) {
    state = turn(state, Math.PI);
    state = walk(state, startX, 2.5);
    state = walk(state, startX, -2.7);
    state = action(state, 'pickup'); assert.equal(state.carriedItem, id);
    state = walk(state, -2.6, -2.7);
    state = action(state, 'place-scale');
    state = action(state, 'weigh');
    state = action(state, 'pickup-scale');
    state = walk(state, -2.6, -2.3);
    state = walk(state, 0.6, -2.3);
    state = action(state, 'place-pack');
    state = action(state, 'pack');
    state = action(state, 'pickup-pack');
    state = walk(state, 2.7, -2.3);
    state = walk(state, 2.7, 3.0);
    state = walk(state, 5.3, 3.0);
    state = action(state, 'place-tail');
    state = walk(state, 7.15, 2.9);
    state = action(state, 'lift');
    for (let frame = 0; frame < 81; frame += 1) state = updateMovement(state, {}, 0.05);
    assert.equal(state.items[id].location, 'loaded');
    state = walk(state, 2.7, 3.0);
  }
  state = walk(state, -6.8, 3.4);
  state = turn(state, 0);
  state = action(state, 'dispatch');
  return state;
}
test('RF-15 complete actual movement route and error tolerance', () => {
  const normal = fullRoute();
  const mistakes = fullRoute(3);
  assert.equal(normal.complete, true);
  assert.equal(normal.records.length, 2);
  assert.equal(normal.loaded.length, 2);
  assert.ok(normal.progress >= 15 && normal.progress <= 45, `Normal reserve ${normal.progress}`);
  assert.ok(mistakes.progress > 0);
  assert.ok(normal.distanceMoved > 70);
  console.log(JSON.stringify({ normal: { reserve: normal.progress, minimum: normal.minimumReserve, meters: normal.distanceMoved, elapsed: normal.elapsed, interactions: normal.interactions }, threeErrors: { reserve: mistakes.progress, minimum: mistakes.minimumReserve } }));
});
test('RF-15 idle and turning are free, blocked movement costs reserve', () => {
  const state = createInitialState();
  assert.equal(updateMovement(state, {}, 0.05).progress, 100);
  assert.equal(updateMovement(state, { turn: 1 }, 0.05).progress, 100);
  let blocked = { ...state, player: { x: -7.8, z: 0, yaw: -Math.PI / 2 } };
  for (let frame = 0; frame < 30; frame += 1) blocked = updateMovement(blocked, { move: 1 }, 0.05);
  assert.ok(blocked.progress < 98);
  assert.ok(blocked.player.x > -8.0);
});
test('RF-15 low reserve reward settlement, cap and reward deduplication', () => {
  const state = createInitialState();
  state.player = { x: -2.6, z: -2.7, yaw: Math.PI }; state.scaleItem = 'tomato'; state.items.tomato.location = 'scale'; state.progress = 0.2;
  const rewarded = interact(state);
  assert.equal(rewarded.failed, false); assert.equal(rewarded.progress, 1.2);
  const full = interact({ ...state, progress: 100 }); assert.equal(full.progress, 100);
  const repeated = { ...state, rewards: ['weigh-tomato'] };
  const failed = interact(repeated); assert.equal(failed.failed, true); assert.equal(failed.items.tomato.weighed, false);
});
test('RF-15 rejects wrong station, wrong facing, occupied placement and invalid drops', () => {
  const state = createInitialState(); state.carriedItem = 'tomato'; state.items.tomato.location = 'carried'; state.player = { x: 0.6, z: -2.3, yaw: Math.PI };
  const rejected = interact(state); assert.equal(rejected.lastEvent, 'weigh_first'); assert.equal(rejected.carriedItem, 'tomato'); assert.equal(rejected.progress, 95);
  const facing = createInitialState(); facing.player = { x: -6.4, z: -2.7, yaw: 0 }; assert.equal(getInteraction(facing), null); assert.equal(interact(facing).progress, 95);
  const occupied = { ...state, player: { x: -2.6, z: -2.7, yaw: Math.PI }, scaleItem: 'apple' }; assert.equal(interact(occupied).lastEvent, 'wrong_station');
  const wall = { ...state, player: { x: -7.7, z: 0, yaw: -Math.PI / 2 } }; assert.equal(interact(wall).lastEvent, 'drop_blocked');
});
test('RF-15 drop and pickup preserve processing, completion/failure freeze and reset', () => {
  let state = createInitialState(); state.carriedItem = 'tomato'; Object.assign(state.items.tomato, { location: 'carried', weighed: true, packed: true });
  state = action(state, 'drop'); state = action(state, 'pickup'); assert.equal(state.items.tomato.packed, true);
  for (const frozen of [{ ...state, complete: true }, { ...state, failed: true }]) { assert.deepEqual(interact(frozen), frozen); assert.deepEqual(updateMovement(frozen, { move: 1 }, 0.05), frozen); }
  assert.deepEqual(createInitialState().rewards, []);
  assert.equal(isWalkable(state, 5.3, -3), false);
});
''')
print('Wrote engine route and failure tests')
