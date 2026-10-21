import test from 'node:test';
import assert from 'node:assert/strict';
import { createVariantEngine } from '../game/levels/rf15/variant-engine.js';
import { LEVEL } from '../game/levels/rf15-3/level.js';
import { ORANGE_ID, ORANGE_TASK, applyOrangeAction } from '../game/levels/rf15/orange-task.js';

const runtime = createVariantEngine(LEVEL);
const completeAnimation = { animationComplete: true };

function at(state, station) {
  const stand = ORANGE_TASK.stands[station];
  state.player = { ...state.player, x: stand.x, z: stand.z, yaw: stand.yaw };
}

function interact(state, type) {
  assert.equal(runtime.getInteraction(state)?.type, type, `expected ${type}, got ${runtime.getInteraction(state)?.type}`);
  const next = runtime.interact(state, completeAnimation);
  assert.equal(next.failed, false, `${type} exhausted the reserve`);
  return next;
}

test('RF-15-3 weighs a full orange basket with a dynamic readout, then packs and loads it', () => {
  let state = runtime.createInitialState();
  assert.equal(state.items[ORANGE_ID].orangeCount, ORANGE_TASK.count);
  assert.equal(state.items[ORANGE_ID].name, '满筐橙子');

  at(state, 'home');
  state = interact(state, 'orange-pickup');
  at(state, 'scale');
  state = interact(state, 'orange-place-scale');
  assert.equal(state.items[ORANGE_ID].weighing, true);
  assert.equal(state.items[ORANGE_ID].stable, false);

  assert.equal(runtime.getInteraction(state)?.type, 'orange-weighing');
  const early = runtime.interact(state, completeAnimation);
  assert.equal(early.errors, state.errors + 1);
  assert.equal(early.items[ORANGE_ID].weighed, false);

  let previous = state.weight;
  for (let index = 0; index < 40; index++) {
    state = runtime.updateEnvironment(state, 0.05);
    if (index < 20) assert.notEqual(state.weight, previous);
    previous = state.weight;
  }
  assert.equal(state.items[ORANGE_ID].stable, false);
  assert.ok(state.weight > 4.5 && state.weight < 5.5);

  for (let index = 0; index < Math.ceil(ORANGE_TASK.stabilitySeconds / .05); index++) state = runtime.updateEnvironment(state, .05);
  assert.equal(state.items[ORANGE_ID].stable, true);
  assert.equal(state.weight, 5);
  assert.equal(runtime.getInteraction(state).type, 'orange-take-scale');
  state = interact(state, 'orange-take-scale');
  assert.equal(state.items[ORANGE_ID].weighed, true);
  assert.equal(state.records.at(-1).kg, 5);
  assert.equal(state.records.at(-1).count, ORANGE_TASK.count);

  at(state, 'pack');
  state = interact(state, 'orange-place-pack');
  state = interact(state, 'orange-pack');
  state = interact(state, 'orange-take-pack');
  at(state, 'tail');
  state = interact(state, 'orange-load');

  assert.equal(state.items[ORANGE_ID].packed, true);
  assert.deepEqual(state.loaded, [ORANGE_ID]);
  assert.equal(state.complete, true);
});

test('RF-15-3 does not expose the legacy per-orange add action', () => {
  const state = runtime.createInitialState();
  const result = applyOrangeAction(runtime.cloneState(state), { type: 'orange-add', item: ORANGE_ID });
  assert.equal(result.error, 'nothing_in_reach');
});

test('RF-15-3 does not trigger the legacy red produce crates', () => {
  const state = runtime.createInitialState();
  state.player = { ...state.player, x: -7.45, z: 0.0, yaw: Math.PI };
  assert.equal(runtime.getInteraction(state), null);
  state.player = { ...state.player, x: -6.82, z: 0.0, yaw: Math.PI };
  assert.equal(runtime.getInteraction(state), null);
});
