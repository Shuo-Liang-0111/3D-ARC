import test from "node:test";
import assert from "node:assert/strict";
import { G1_LOCOMOTION } from "../game/g1-locomotion.js";
import { createInitialState, getInteraction, interact, isWalkable, updateMovement } from "../game/engine.js";
import { RF01_COLLISION_PROXY_RECTS } from "../game/rf01-collision-proxies.js";
import { DOOR_COLLIDER, installRF01CollisionProxies } from "../game/level.js";
import { LEVEL, WORKSHOP } from "../game/levels/rf01/level.js";
function getRF01StaticColliders() { return LEVEL.staticColliders; }

assert.equal(installRF01CollisionProxies(RF01_COLLISION_PROXY_RECTS), true);

function place(state, point) {
  return { ...state, player: { ...state.player, x: point.x, z: point.z } };
}

function hasWalkableRoute(state, target, range = LEVEL.interactionRange) {
  const step = 0.35;
  const queue = [{ x: state.player.x, z: state.player.z, ix: 0, iz: 0 }];
  const visited = new Set(["0,0"]);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (Math.hypot(current.x - target.x, current.z - target.z) <= range) return true;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ix = current.ix + dx;
      const iz = current.iz + dz;
      const key = `${ix},${iz}`;
      if (visited.has(key)) continue;
      visited.add(key);
      const x = state.player.x + ix * step;
      const z = state.player.z + iz * step;
      if (isWalkable(state, x, z)) queue.push({ x, z, ix, iz });
    }
  }
  return false;
}

test("the robot turns toward a screen direction before moving", () => {
  const initial = createInitialState();
  const turning = updateMovement(initial, { x: 1, z: 0 }, 0.05);
  assert.equal(turning.player.x, initial.player.x);
  assert.equal(turning.player.z, initial.player.z);
  assert.equal(turning.motion, "turning");
  let moved = turning;
  for (let index = 0; index < 24; index += 1) moved = updateMovement(moved, { x: 1, z: 0 }, 0.05);
  assert.ok(moved.player.x > initial.player.x);
  assert.equal(isWalkable(initial, LEVEL.door.x, LEVEL.door.z), false);
  assert.equal(isWalkable({ ...initial, doorOpen: true }, LEVEL.door.x, LEVEL.door.z), true);
});

test("direction input drains mission reserve even when movement is blocked", () => {
  const initial = createInitialState();
  const idle = updateMovement(initial, { x: 0, z: 0 }, 0.05);
  const moved = updateMovement(initial, { x: 0, z: -1 }, 0.05);
  const againstWall = {
    ...initial,
    player: { x: initial.player.x, z: LEVEL.bounds.minZ + LEVEL.playerRadius, yaw: Math.PI },
  };
  const blocked = updateMovement(againstWall, { x: 0, z: -1 }, 0.05);
  assert.equal(idle.progress, initial.progress);
  assert.ok(Math.abs(moved.progress - (initial.progress - moved.distanceMoved * LEVEL.progress.perMeter)) < 1e-9);
  assert.deepEqual(blocked.player, againstWall.player);
  assert.ok(Math.abs(blocked.progress - (initial.progress - .05 * LEVEL.progress.blockedPerSecond)) < 1e-9);
});

test("RF-01 relative controls turn in place and move along the robot heading", () => {
  const initial = createInitialState();
  const left = updateMovement(initial, { move: 0, turn: -1 }, 0.05);
  const right = updateMovement(initial, { move: 0, turn: 1 }, 0.05);
  assert.deepEqual({ x: left.player.x, z: left.player.z }, { x: initial.player.x, z: initial.player.z });
  assert.deepEqual({ x: right.player.x, z: right.player.z }, { x: initial.player.x, z: initial.player.z });
  assert.ok(left.player.yaw < initial.player.yaw);
  assert.ok(right.player.yaw > initial.player.yaw);
  assert.equal(left.progress, initial.progress);

  const forward = updateMovement(initial, { move: 1, turn: 0 }, 0.05);
  const backward = updateMovement(initial, { move: -1, turn: 0 }, 0.05);
  const heading = { x: Math.sin(initial.player.yaw), z: Math.cos(initial.player.yaw) };
  assert.equal(forward.player.yaw, initial.player.yaw);
  assert.equal(backward.player.yaw, initial.player.yaw);
  assert.ok((forward.player.x - initial.player.x) * heading.x + (forward.player.z - initial.player.z) * heading.z > 0);
  assert.ok((backward.player.x - initial.player.x) * heading.x + (backward.player.z - initial.player.z) * heading.z < 0);
});

test("RF-01 uses calibrated G1 walking and turn speeds", () => {
  assert.equal(LEVEL.moveSpeed, G1_LOCOMOTION.moveSpeed);
  assert.equal(LEVEL.turnSpeed, G1_LOCOMOTION.turnSpeed);
});

test("carrying while translating still reports moving for the walking gait", () => {
  const carrying = createInitialState();
  carrying.battery = { location: "carried" };
  const moved = updateMovement(carrying, { move: 1, turn: 0 }, 0.05);
  assert.equal(moved.motion, "moving");
  assert.equal(moved.battery.location, "carried");
});

test("first-time milestones restore reserve and cannot be farmed", () => {
  let state = createInitialState();
  state = place(state, state.battery);
  state = interact(state);
  assert.equal(state.progress, 100);

  state = { ...place(state, LEVEL.powerSlot), progress: 30 };
  state = interact(state);
  assert.equal(state.progress, 33);

  state = { ...place(state, LEVEL.door), progress: 30 };
  state = interact(state);
  assert.equal(state.progress, 33);
  state = interact(state);
  assert.equal(state.progress, 33);
  state = interact(state);
  assert.equal(state.progress, 33);
});

test("zero reserve fails the level and freezes movement and interaction", () => {
  const endangered = { ...createInitialState(), progress: 0.01 };
  const failed = updateMovement(endangered, { x: 0, z: -1 }, 0.05);
  assert.equal(failed.progress, 0);
  assert.equal(failed.failed, true);
  assert.equal(failed.lastEvent, "progress_depleted");

  const frozen = updateMovement(failed, { x: 1, z: 0 }, 0.05);
  assert.deepEqual(frozen.player, failed.player);
  assert.equal(getInteraction(failed), null);
  assert.deepEqual(interact(failed), failed);
});

test("E interaction completes the battery, slot, powered door and exit sequence", () => {
  let state = createInitialState();
  state = place(state, state.battery);
  assert.equal(getInteraction(state).type, "battery");
  state = interact(state);
  assert.equal(state.battery.location, "carried");

  state = place(state, LEVEL.powerSlot);
  assert.equal(getInteraction(state).type, "slot");
  state = interact(state);
  assert.equal(state.powered, true);
  assert.equal(state.battery.location, "slotted");

  state = place(state, LEVEL.door);
  state = interact(state);
  assert.equal(state.doorOpen, true);

  const exitApproachZ = LEVEL.exit.z - LEVEL.exit.radius - 0.1;
  state = { ...place(state, { x: LEVEL.exit.x, z: exitApproachZ }), player: { x: LEVEL.exit.x, z: exitApproachZ, yaw: 0 } };
  for (let index = 0; index < 3 && !state.complete; index += 1) {
    state = updateMovement(state, { x: 0, z: 1 }, 0.05);
  }
  assert.equal(state.complete, true);
});

test("a carried battery can be dropped on ordinary walkable ground", () => {
  let state = createInitialState();
  state = place(state, state.battery);
  state = interact(state);
  state = place(state, { x: -4, z: 2 });
  assert.equal(getInteraction(state).type, "drop");
  state = interact(state);
  assert.deepEqual(state.battery, { location: "ground", x: -4, z: 1 });
});

test("the maintenance terminal opens regardless of the current power state", () => {
  let state = place(createInitialState(), LEVEL.terminal);
  assert.equal(getInteraction(state).type, "terminal");
  state = interact(state);
  assert.equal(state.terminalOpen, true);
  state = interact(state);
  assert.equal(state.terminalOpen, false);
});

test("RF-01 uses a meter-scale Chinese industrial park layout", () => {
  assert.equal(LEVEL.bounds.maxX - LEVEL.bounds.minX, 19.6);
  assert.equal(LEVEL.bounds.maxZ - LEVEL.bounds.minZ, 15.6);
  assert.equal(LEVEL.playerRadius, 0.34);
  assert.equal(LEVEL.playerForwardOffset, 0.18);
  assert.equal(LEVEL.door.x, 0);
  assert.equal(LEVEL.door.z, 6.8);
  assert.ok(getRF01StaticColliders().some((collider) => collider.id === "workshop-front-left"));
  assert.ok(getRF01StaticColliders().some((collider) => collider.id === "electrical-compound"));
  const colliders = Object.fromEntries(getRF01StaticColliders().map((collider) => [collider.id, collider]));
  assert.deepEqual(colliders["north-fence"], { id: "north-fence", minX: -9.88, maxX: 9.88, minZ: -7.76, maxZ: -7.6 });
  assert.deepEqual(colliders["workshop-front-left"], { id: "workshop-front-left", minX: -5.07, maxX: -.38, minZ: -1.85, maxZ: -1.08 });
  assert.deepEqual(colliders["battery-rack"], { id: "battery-rack", minX: -7.68, maxX: -5.92, minZ: -0.8, maxZ: 0.1 });
  const fireStation = colliders["fire-safety-station"];
  assert.ok(Math.abs(fireStation.minX - 8.55) < 1e-9);
  assert.ok(Math.abs(fireStation.maxX - 9.05) < 1e-9);
  assert.ok(Math.abs(fireStation.minZ + 1.6) < 1e-9);
  assert.ok(Math.abs(fireStation.maxZ + 0.2) < 1e-9);
  assert.ok(colliders["south-fence-west"].maxZ - colliders["south-fence-west"].minZ < 0.17);
  assert.ok(colliders["gate-bollard-west"].maxZ - colliders["gate-bollard-west"].minZ < 0.37);
  assert.equal(DOOR_COLLIDER.maxZ - DOOR_COLLIDER.minZ < 0.17, true);
});

test("RF-01 collision clearance follows the visible proxy plus the G1 body envelope", () => {
  const closed = createInitialState();
  const workshop = WORKSHOP.doorway;
  const gate = DOOR_COLLIDER;
  const facingGate = { ...closed, player: { ...closed.player, yaw: 0 } };

  const forwardClearance = LEVEL.playerRadius + LEVEL.playerForwardOffset;
  assert.equal(isWalkable(closed, 0, workshop.maxZ + forwardClearance - 0.01), false);
  assert.equal(isWalkable(closed, 0, workshop.maxZ + forwardClearance + 0.01), true);
  assert.equal(isWalkable(facingGate, 0, gate.minZ - forwardClearance + 0.01), false);
  assert.equal(isWalkable(facingGate, 0, gate.minZ - forwardClearance - 0.01), true);
  assert.equal(isWalkable(closed, 0, -4), true);
  assert.equal(isWalkable(closed, 8.8, -0.9), false);

  let turningNearWorkshop = {
    ...closed,
    player: { x: 0, z: workshop.maxZ + LEVEL.playerRadius + 0.02, yaw: Math.PI / 2 },
  };
  assert.equal(isWalkable(turningNearWorkshop, turningNearWorkshop.player.x, turningNearWorkshop.player.z), true);
  for (let index = 0; index < 20; index += 1) turningNearWorkshop = updateMovement(turningNearWorkshop, { move: 0, turn: 1 }, 0.05);
  assert.ok(turningNearWorkshop.player.yaw < 1.8);
  assert.equal(isWalkable(turningNearWorkshop, turningNearWorkshop.player.x, turningNearWorkshop.player.z), true);
});

test("the industrial park keeps every objective reachable", () => {
  const closed = createInitialState();
  assert.equal(hasWalkableRoute(closed, LEVEL.batteryStart), true);
  assert.equal(hasWalkableRoute(closed, LEVEL.powerSlot), true);
  assert.equal(hasWalkableRoute(closed, LEVEL.terminal), true);
  assert.equal(hasWalkableRoute(closed, LEVEL.door), true);
  assert.equal(hasWalkableRoute({ ...closed, doorOpen: true }, LEVEL.exit, LEVEL.exit.radius), true);
});
