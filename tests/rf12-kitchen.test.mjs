import test from "node:test";
import assert from "node:assert/strict";
import { HAZARD_TYPES, LEVEL } from "../game/levels/rf12/level.js";
import { createInitialState, getInteraction, interact, isWalkable, updateMovement } from "../game/levels/rf12/engine.js";

const at = (state, point) => ({ ...state, player: { ...state.player, x: point.x, z: point.z } });
const use = (state, point) => interact(at(state, point));

test("RF-12 shares global locomotion and keeps the entry walkable", () => {
  const initial = createInitialState();
  const moved = updateMovement(initial, { move: 1, turn: 0 }, 0.05);
  assert.equal(LEVEL.moveSpeed, 1.4);
  assert.equal(LEVEL.turnSpeed, 1.8);
  assert.ok(moved.progress < initial.progress);
  assert.equal(isWalkable(initial, LEVEL.playerStart.x, LEVEL.playerStart.z), true);
});

test("RF-12 resolves the five kitchen hazards and completes at the terminal", () => {
  let state = createInitialState();
  state = use(state, LEVEL.checklist);
  state = use(state, LEVEL.gasKnob);
  state = use(state, LEVEL.hood);
  state = use(state, LEVEL.window);
  state = use(state, LEVEL.cloth);
  assert.equal(state.carriedItem, "cloth");
  state = use(state, LEVEL.sink);
  state = use(state, LEVEL.gasValve);
  assert.deepEqual(HAZARD_TYPES.map((type) => state.hazards[type]), [true, true, true, true, true]);
  assert.equal(state.complete, false);
  state = use(state, LEVEL.terminal);
  assert.equal(state.complete, true);
  assert.equal(state.progress, 100);
});

test("gas valve cannot close before the knob is reset", () => {
  let state = createInitialState();
  state = use(state, LEVEL.gasValve);
  assert.equal(state.hazards.gasValve, false);
  assert.equal(state.lastEvent, "gas_valve_requires_knob");
});

test("entry and all interaction zones have a reachable approach", () => {
  const state = createInitialState();
  const step = 0.25;
  const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const queue = [{ x: state.player.x, z: state.player.z }];
  const visited = new Set([key(queue[0].x, queue[0].z)]);
  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const next = { x: point.x + dx, z: point.z + dz };
      const nextKey = key(next.x, next.z);
      if (!visited.has(nextKey) && isWalkable(state, next.x, next.z)) { visited.add(nextKey); queue.push(next); }
    }
  }
  for (const target of [LEVEL.checklist, LEVEL.gasKnob, LEVEL.hood, LEVEL.window, LEVEL.gasValve, LEVEL.cloth, LEVEL.sink, LEVEL.terminal]) assert.ok(queue.some((point) => Math.hypot(point.x - target.x, point.z - target.z) <= LEVEL.interactionRange), JSON.stringify(target));
});

test("completed and failed states freeze interaction and movement", () => {
  const complete = { ...createInitialState(), complete: true };
  assert.deepEqual(updateMovement(complete, { move: 1, turn: 1 }, 0.05).player, complete.player);
  assert.deepEqual(getInteraction(complete), null);
});
