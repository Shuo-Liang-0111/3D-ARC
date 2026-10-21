import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, cloneState, updateMovement, updateEnvironment, interact, isWalkable, getInteraction } from "../game/levels/rf01-2/engine.js";
import { LEVEL, WORKSHOP } from "../game/levels/rf01-2/level.js";

function walkTo(initial, x, z) {
  let state = initial;
  for (let frame = 0; frame < 2000; frame += 1) {
    const dx = x - state.player.x;
    const dz = z - state.player.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .01) return state;
    const delta = Math.min(.02, distance / LEVEL.moveSpeed);
    const yaw = state.player.yaw;
    state = updateMovement(state, {
      move: (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / distance,
      strafe: (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / distance,
    }, delta);
    assert.equal(state.failed, false, "route depleted");
  }
  assert.fail("route blocked at " + JSON.stringify(state.player));
}

function openDoor(initial) {
  // This existing door/lighting fixture starts after power installation.
  let state = walkTo({ ...initial, powered: true, battery: { location: "slotted", ...LEVEL.powerSlot } }, -.68, 0);
  assert.equal(getInteraction(state)?.type, "shutter");
  state = interact(state);
  for (let frame = 0; frame < 160; frame += 1) state = updateEnvironment(state, .02);
  assert.equal(state.shutterLift, WORKSHOP.height);
  return state;
}

function completeRoute(initial) {
  let state = openDoor(initial);
  state = walkTo(state, 1.6, 0);
  state = walkTo(state, 1.6, -3);
  assert.equal(state.enteredWorkshop, true);
  state = walkTo(state, 3.8, -3);
  state = walkTo(state, 3.8, -5.5);
  assert.equal(getInteraction(state)?.type, "lights");
  state = interact(state);
  assert.equal(state.complete, true);
  return state;
}

test("a continuous engine route opens the shutter, enters and turns on lighting", () => {
  const state = completeRoute(createInitialState());
  assert.ok(state.progress > 70 && state.progress < 95);
  assert.equal(state.lightsOn, true);
  console.log(JSON.stringify({ route: "normal", distance: state.distanceMoved, reserve: state.progress, minimum: state.minimumReserve }));
});

test("three actual wrong interactions still allow the complete route", () => {
  let state = createInitialState();
  for (let count = 0; count < 3; count += 1) state = interact(state);
  const final = completeRoute(state);
  console.log(JSON.stringify({ route: "three-errors", distance: final.distanceMoved, reserve: final.progress, minimum: final.minimumReserve }));
});

test("closed and partly raised doors block; full clearance opens only the doorway", () => {
  const state = createInitialState();
  assert.equal(isWalkable(state, 1.6, -1.4), false);
  state.shutterRequested = true;
  state.shutterLift = WORKSHOP.clearance - .01;
  assert.equal(isWalkable(state, 1.6, -1.4), false);
  state.shutterLift = WORKSHOP.height;
  assert.equal(isWalkable(state, 1.6, -1.4), true);
  assert.equal(isWalkable(state, -1.5, -1.4), false);
  assert.equal(isWalkable(state, 4.5, -1.4), false);
  assert.equal(isWalkable(state, 5.02, -4), false);
  assert.equal(isWalkable(state, 0, -6.9), false);
  assert.equal(isWalkable(state, 0, 6.8), false);
});

test("collision checks both torso and forward body envelope", () => {
  const state = createInitialState();
  state.shutterLift = WORKSHOP.height;
  state.player.yaw = 0;
  assert.equal(isWalkable(state, 1.6, -2.1), true);
  state.player.yaw = Math.PI / 2;
  assert.equal(isWalkable(state, 4.5, -4), false);
});

test("light cannot be operated from outdoors, wrong direction, or without entering", () => {
  let state = createInitialState();
  state.player = { x: -.68, z: 0, yaw: 0 };
  assert.equal(getInteraction(state), null);
  assert.equal(interact(state).progress, 95);
  state.player = { x: 3.8, z: -5.5, yaw: Math.PI };
  state.shutterLift = WORKSHOP.height;
  assert.equal(interact(state).lightsOn, false);
  state.enteredWorkshop = true;
  state.player.yaw = 0;
  assert.equal(interact(state).lightsOn, false);
});

test("reward is first-time only and reset clears all milestones", () => {
  let state = openDoor(createInitialState());
  const before = state.progress;
  state = interact(state);
  assert.equal(state.progress, before - 5);
  assert.deepEqual(createInitialState().rewardedMilestones, {});
  assert.equal(createInitialState().lightsOn, false);
  assert.equal(createInitialState().shutterLift, 0);
});

test("successful low-reserve operations reward once and cap at initial maximum", () => {
  let state = createInitialState();
  state.player = { x: -.68, z: 0, yaw: Math.PI };
  state.powered = true;
  state.battery = { location: "slotted", ...LEVEL.powerSlot };
  state.progress = .2;
  assert.ok(interact(state).progress > .2);
  state.progress = 99;
  assert.equal(interact(state).progress, 100);
});

test("empty operation exhaustion freezes state and cannot revive", () => {
  const state = createInitialState();
  state.progress = 4;
  const failed = interact(state);
  assert.equal(failed.failed, true);
  assert.equal(failed.shutterRequested, false);
  assert.deepEqual(interact(failed), failed);
  assert.deepEqual(updateMovement(failed, { move: 1 }, 1), failed);
  assert.deepEqual(updateEnvironment(failed, 1), failed);
});

test("completion freezes motion and environment", () => {
  const complete = completeRoute(createInitialState());
  assert.deepEqual(interact(complete), complete);
  assert.deepEqual(updateMovement(complete, { move: 1 }, 1), complete);
  assert.deepEqual(updateEnvironment(complete, 1), complete);
});

test("idle and pure turning are free, wall attempts consume reserve, drain bypass is ignored", () => {
  const state = createInitialState();
  assert.equal(updateMovement(state, {}, .05).progress, 100);
  assert.equal(updateMovement(state, { turn: 1 }, .05).progress, 100);
  state.player = { x: 1.6, z: -.62, yaw: Math.PI };
  assert.ok(updateMovement(state, { move: 1, drain: false }, .05).progress < 100);
  const moved = updateMovement(createInitialState(), { move: 1, drain: false }, .05);
  assert.ok(moved.progress < 100);
  assert.notEqual(cloneState(state).player, state.player);
});
