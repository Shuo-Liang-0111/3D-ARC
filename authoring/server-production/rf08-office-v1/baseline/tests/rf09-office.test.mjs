import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createInitialState, getInteraction, interact, isWalkable, updateMovement } from "../game/levels/rf09/engine.js";
import { DEVICE_TYPES, LEVEL } from "../game/levels/rf09/level.js";

const at = (state, point) => ({ ...state, player: { ...state.player, x: point.x, z: point.z } });
const pickup = (state, type) => interact(at(state, state.devices[type]));
const install = (state, type) => interact(at(pickup(state, type), LEVEL.podium));

test("RF-09 starts at reception with two office devices", () => {
  const state = createInitialState();
  assert.deepEqual(DEVICE_TYPES.map((type) => state.devices[type].location), ["office", "office"]);
  assert.equal(state.player.yaw, Math.PI);
  assert.equal(state.progress, 100);
});

test("G1 movement uses forward translation and in-place yaw", () => {
  const initial = createInitialState();
  const turned = updateMovement(initial, { move: 0, turn: 1 }, 0.05);
  assert.equal(turned.player.x, initial.player.x);
  assert.equal(turned.player.z, initial.player.z);
  assert.ok(turned.player.yaw > initial.player.yaw);
  assert.ok(turned.progress < initial.progress);
  const clear = at(initial, { x: 5, z: 4 });
  const forward = updateMovement(clear, { move: 1, turn: 0 }, 0.05);
  const displacement = { x: forward.player.x - clear.player.x, z: forward.player.z - clear.player.z };
  const heading = { x: Math.sin(clear.player.yaw), z: Math.cos(clear.player.yaw) };
  assert.ok(displacement.x * heading.x + displacement.z * heading.z > 0);
});

test("clicker is rejected until the video adapter is installed", () => {
  let state = pickup(createInitialState(), "clicker");
  state = interact(at(state, LEVEL.podium));
  assert.equal(state.lastEvent, "device_rejected_order");
  assert.equal(state.carriedItem, "clicker");
  assert.deepEqual(state.installedDevices, []);
});

test("adapter then clicker arms the conference terminal", () => {
  let state = install(createInitialState(), "adapter");
  state = install(state, "clicker");
  assert.deepEqual(state.installedDevices, ["adapter", "clicker"]);
  assert.equal(state.presentationReady, true);
  assert.equal(state.carriedItem, null);
});

test("terminal needs two interactions to confirm and start presentation", () => {
  let state = install(createInitialState(), "adapter");
  state = install(state, "clicker");
  state = interact(at(state, LEVEL.terminal));
  assert.equal(state.terminalOpen, true);
  assert.equal(state.complete, false);
  assert.equal(getInteraction(state).type, "presentation-start");
  state = interact(state);
  assert.equal(state.complete, true);
  assert.equal(state.terminalOpen, false);
  assert.equal(state.progress, 100);
});

test("all task approach points are reachable through the open office routes", () => {
  const state = createInitialState(); const step = 0.35; const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`; const queue = [{ x: state.player.x, z: state.player.z }]; const visited = new Set([key(queue[0].x, queue[0].z)]);
  for (let index = 0; index < queue.length; index += 1) { const point = queue[index]; for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) { const next = { x: point.x + dx, z: point.z + dz }; const nextKey = key(next.x, next.z); if (visited.has(nextKey) || !isWalkable(state, next.x, next.z)) continue; visited.add(nextKey); queue.push(next); } }
  for (const target of [...Object.values(LEVEL.devices), LEVEL.podium, LEVEL.terminal]) assert.ok(queue.some((point) => Math.hypot(point.x - target.x, point.z - target.z) <= LEVEL.interactionRange), `unreachable ${JSON.stringify(target)}`);
});

test("office fixtures have collision while entry and conference door remain open", () => {
  const state = createInitialState();
  for (const id of ["conference-table", "supply-cabinet", "it-locker", "reception-desk", "cubicle-west-1", "cubicle-east-2"]) { const collider = LEVEL.staticColliders.find((entry) => entry.id === id); assert.ok(collider, id); assert.equal(isWalkable(state, (collider.minX + collider.maxX) / 2, (collider.minZ + collider.maxZ) / 2), false, id); }
  assert.equal(LEVEL.staticColliders.some((entry) => ["podium", "terminal"].includes(entry.id)), false, "tabletop equipment reuses the conference-table collider");
  assert.equal(isWalkable(state, 0, 8.25), true, "south entry");
  assert.equal(isWalkable(state, 0, -2.1), true, "conference door");
});

test("RF-09 is registered and explains the new G1 controls", async () => {
  const app = await readFile(new URL("../game/app.js", import.meta.url), "utf8"); const html = await readFile(new URL("../index.html", import.meta.url), "utf8"); const runtime = await readFile(new URL("../game/levels/rf09/runtime.js", import.meta.url), "utf8");
  assert.match(app, /rf09: \(\) => import\("\.\/levels\/rf09\/runtime\.js"\)/);
  assert.match(html, /data-level-option="rf09"/);
  assert.match(runtime, /W\/S 前进后退，A\/D 左右平移/);
  assert.match(runtime, /Q\/E 转向且不消耗余量/);
  assert.match(runtime, /D435/);
});
