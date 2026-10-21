import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { G1_LOCOMOTION } from "../game/g1-locomotion.js";
import { DOOR_COLLIDER, LEVEL, OPEN_DOOR_COLLIDER } from "../game/levels/test_zpf2/level.js";
import { allChecked, checklistCount, closeTerminal, createInitialState, getInteraction, getObjective, interact, isWalkable, updateMovement } from "../game/levels/test_zpf2/engine.js";
import * as runtime from "../game/levels/test_zpf2/runtime.js";
import { PROCEDURAL_ASSETS, SCENE_ROOT_NAME } from "../game/levels/test_zpf2/scene.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const at = (state, point) => ({ ...state, player: { ...state.player, x: point.x, z: point.z } });
const STAND = Object.freeze({
  whiteboard: { x: -1.05, z: -0.35 },
  workstation: { x: 0.2, z: 0.1 },
  aircon: { x: 1.0, z: 0.12 },
  door: { x: -0.65, z: 1.7 },
});
const ANCHORS = Object.freeze({ whiteboard: LEVEL.whiteboard, workstation: LEVEL.workstation, aircon: LEVEL.airConditioner, door: LEVEL.door });

function completeChecklist(state) {
  state = interact(at(state, STAND.whiteboard));
  state = interact(at(state, STAND.workstation));
  state = closeTerminal(state);
  return interact(at(state, STAND.aircon));
}

function reachable(state) {
  const step = 0.3;
  const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const queue = [{ x: state.player.x, z: state.player.z }];
  const visited = new Set([key(queue[0].x, queue[0].z)]);
  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const next = { x: point.x + dx, z: point.z + dz };
      const nextKey = key(next.x, next.z);
      if (visited.has(nextKey) || !isWalkable(state, next.x, next.z)) continue;
      visited.add(nextKey);
      queue.push(next);
    }
  }
  return queue;
}

test("test_zpf2 starts inside the office facing north with the checklist empty", () => {
  const state = createInitialState();
  assert.equal(LEVEL.id, "test_zpf2");
  assert.deepEqual(state.player, { x: -0.35, z: 1.35, yaw: Math.PI });
  assert.equal(state.progress, 60);
  assert.equal(checklistCount(state), 0);
  assert.equal(allChecked(state), false);
  assert.equal(state.doorOpen, false);
  assert.equal(state.lastEvent, "office_entered");
  assert.equal(isWalkable(state, state.player.x, state.player.z), true);
  assert.equal(getObjective(state).step, 1);
  assert.equal(getObjective(state).title, "查看白板");
});

test("test_zpf2 shares the calibrated G1 locomotion envelope", async () => {
  assert.equal(LEVEL.moveSpeed, G1_LOCOMOTION.moveSpeed);
  assert.equal(LEVEL.turnSpeed, G1_LOCOMOTION.turnSpeed);
  const source = await read("../game/levels/test_zpf2/level.js");
  assert.match(source, /G1_LOCOMOTION/);
  assert.doesNotMatch(source, /moveSpeed:\s*[0-9]|turnSpeed:\s*[0-9]/);
});

test("W/S translate along the heading, turning stays in place and only movement drains reserve", () => {
  const initial = createInitialState();
  const turned = updateMovement(initial, { move: 0, strafe: 0, turn: 1 }, 0.05);
  assert.equal(turned.player.x, initial.player.x);
  assert.equal(turned.player.z, initial.player.z);
  assert.ok(turned.player.yaw > initial.player.yaw);
  assert.equal(turned.motion, "turning");
  const freeTurn = updateMovement(initial, { move: 0, strafe: 0, turn: 1, drain: false }, 0.05);
  assert.equal(freeTurn.progress, initial.progress);
  const forward = updateMovement(initial, { move: 1, strafe: 0, turn: 0 }, 0.05);
  const displacement = { x: forward.player.x - initial.player.x, z: forward.player.z - initial.player.z };
  assert.ok(displacement.x * Math.sin(initial.player.yaw) + displacement.z * Math.cos(initial.player.yaw) > 0);
  assert.ok(Math.abs(Math.hypot(displacement.x, displacement.z) - LEVEL.moveSpeed * 0.05) < 1e-9);
  assert.ok(forward.progress < initial.progress);
  assert.equal(forward.motion, "moving");
});

test("visible furniture blocks movement while the room stays walkable", () => {
  const state = createInitialState();
  for (const id of ["desk", "cabinet", "pedestal", "whiteboard", "air-conditioner", "folding-cot", "storage-cubes", "monitor-cartons", "carton-tall", "visitor-chair-west", "visitor-chair-east"]) {
    const collider = LEVEL.staticColliders.find((entry) => entry.id === id);
    assert.ok(collider, id);
    assert.equal(isWalkable(state, (collider.minX + collider.maxX) / 2, (collider.minZ + collider.maxZ) / 2), false, id);
  }
  assert.equal(isWalkable(state, 0, 0.8), true, "room centre");
  assert.equal(isWalkable(state, -0.95, -0.45), true, "aisle between whiteboard and visitor chair");
  let walker = at(state, { x: 0.27, z: 0 });
  for (let tick = 0; tick < 20; tick += 1) walker = updateMovement(walker, { move: 1, strafe: 0, turn: 0 }, 0.05);
  assert.ok(walker.player.z < -0.4 && walker.player.z > -0.6, `desk front edge stops forward motion at z=${walker.player.z.toFixed(2)}`);
  assert.ok(walker.progress < state.progress, "blocked input still drains");
});

test("the office door blocks the vestibule until it is opened", () => {
  const state = createInitialState();
  const doorway = { x: (DOOR_COLLIDER.minX + DOOR_COLLIDER.maxX) / 2, z: 2.2 };
  assert.equal(isWalkable(state, doorway.x, doorway.z), false);
  assert.equal(isWalkable({ ...state, doorOpen: true }, doorway.x, doorway.z), true);
  assert.equal(isWalkable({ ...state, doorOpen: true }, (OPEN_DOOR_COLLIDER.minX + OPEN_DOOR_COLLIDER.maxX) / 2, 2.7), false, "open leaf occupies the hinge side");
  assert.equal(isWalkable({ ...state, doorOpen: true }, LEVEL.exit.x, LEVEL.exit.z), true, "exit zone is walkable once open");
  assert.equal(isWalkable(state, -1.6, 2.2), false, "south wall west");
  assert.equal(isWalkable(state, 1.0, 2.2), false, "south wall east");
});

test("every checkpoint has a walkable stand inside the interaction range", () => {
  const state = createInitialState();
  for (const [type, stand] of Object.entries(STAND)) {
    assert.equal(isWalkable(state, stand.x, stand.z), true, type);
    assert.ok(Math.hypot(stand.x - ANCHORS[type].x, stand.z - ANCHORS[type].z) <= LEVEL.interactionRange, type);
    assert.equal(getInteraction(at(state, stand))?.type, type);
  }
  assert.equal(getInteraction(at(state, { x: 0, z: 0.9 })), null, "room centre has no target");
});

test("checklist rewards are granted once and the door stays locked until all three are done", () => {
  let state = createInitialState();
  state = interact(at(state, STAND.whiteboard));
  assert.equal(state.lastEvent, "whiteboard_reviewed");
  assert.equal(state.progress, 68);
  state = interact(state);
  assert.equal(state.lastEvent, "whiteboard_reviewed");
  assert.equal(state.progress, 68, "re-reading the whiteboard is free but unrewarded");
  state = interact(at(state, STAND.door));
  assert.equal(state.lastEvent, "door_locked");
  assert.equal(state.doorOpen, false);
  assert.equal(state.progress, 68);
  state = interact(at(state, STAND.workstation));
  assert.equal(state.lastEvent, "workstation_checked");
  assert.equal(state.terminalOpen, true);
  assert.equal(state.progress, 76);
  const frozen = updateMovement(state, { move: 1, strafe: 0, turn: 0 }, 0.05);
  assert.deepEqual(frozen.player, state.player, "no movement while the workstation is open");
  assert.equal(getInteraction(state).type, "terminal-close");
  state = interact(state);
  assert.equal(state.terminalOpen, false);
  assert.equal(state.lastEvent, "terminal_closed");
  state = interact(at(state, STAND.aircon));
  assert.equal(state.lastEvent, "aircon_started");
  assert.equal(state.airconOn, true);
  assert.equal(state.progress, 88);
  state = interact(state);
  assert.equal(state.lastEvent, "aircon_stopped");
  assert.equal(allChecked(state), false);
  state = interact(state);
  assert.equal(state.lastEvent, "aircon_started");
  assert.equal(state.progress, 88, "restarting the air conditioner is not rewarded twice");
  assert.equal(allChecked(state), true);
  assert.equal(getObjective(state).title, "打开房门");
  assert.equal(runtime.getTelemetry(state).gate, "UNLOCKED");
});

test("opening the door and walking into the vestibule completes the survey", () => {
  let state = completeChecklist(createInitialState());
  state = interact(at(state, STAND.door));
  assert.equal(state.lastEvent, "door_opened");
  assert.equal(state.doorOpen, true);
  assert.equal(state.progress, 100);
  assert.equal(getObjective(state).title, "离开办公室");
  state = at(state, { x: LEVEL.exit.x, z: LEVEL.exit.z - 0.3 });
  state = { ...state, player: { ...state.player, yaw: 0 } };
  for (let tick = 0; tick < 12 && !state.complete; tick += 1) state = updateMovement(state, { move: 1, strafe: 0, turn: 0 }, 0.05);
  assert.equal(state.complete, true);
  assert.equal(state.lastEvent, "exit_reached");
  assert.equal(state.progress, LEVEL.progress.maximum);
  assert.equal(state.motion, "idle");
  const after = updateMovement(state, { move: 1, strafe: 0, turn: 0 }, 0.05);
  assert.deepEqual(after.player, state.player, "movement freezes after completion");
  assert.equal(getInteraction(state), null);
  assert.equal(runtime.getProgressSteps(state).every((step) => step.done), true);
});

test("reserve depletion fails the survey and freezes the robot", () => {
  let state = createInitialState();
  state = { ...state, progress: 0.05, terminalOpen: false };
  state = updateMovement(at(state, { x: 0, z: 0.8 }), { move: 1, strafe: 0, turn: 0 }, 0.05);
  assert.equal(state.failed, true);
  assert.equal(state.progress, 0);
  assert.equal(state.lastEvent, "progress_depleted");
  assert.equal(getObjective(state).step, 0);
  const after = updateMovement(state, { move: 1, strafe: 0, turn: 0 }, 0.05);
  assert.deepEqual(after.player, state.player);
  assert.equal(getInteraction(state), null);
  assert.equal(interact(at(state, STAND.whiteboard)).whiteboardReviewed, false);
});

test("all checkpoints and the exit are reachable from the spawn point", () => {
  const closed = createInitialState();
  const closedPoints = reachable(closed);
  for (const [type, anchor] of Object.entries(ANCHORS)) {
    assert.ok(closedPoints.some((point) => Math.hypot(point.x - anchor.x, point.z - anchor.z) <= LEVEL.interactionRange), `unreachable ${type}`);
  }
  assert.equal(closedPoints.some((point) => point.z > 2.3), false, "the vestibule is sealed while the door is closed");
  const open = { ...closed, doorOpen: true };
  const openPoints = reachable(open);
  assert.ok(openPoints.some((point) => Math.hypot(point.x - LEVEL.exit.x, point.z - LEVEL.exit.z) <= LEVEL.exit.radius), "exit reachable through the open door");
});

test("runtime contract covers every engine event and the fixed HUD slots", () => {
  for (const key of ["id", "brand", "unit", "systemLabel", "cargoLabel", "gateLabel", "startKicker", "startTitle", "startCopy", "completeKicker", "completeTitle", "completeCopy", "terminalHeading"]) assert.ok(runtime.ui[key], key);
  assert.equal(runtime.ui.id, "test_zpf2");
  assert.equal(runtime.camera.position.length, 3);
  assert.equal(runtime.camera.lookAt.length, 3);
  assert.ok(runtime.camera.fov > 20 && runtime.camera.fov < 90);
  const engineSource = readFile(new URL("../game/levels/test_zpf2/engine.js", import.meta.url), "utf8");
  return engineSource.then((source) => {
    const events = [...new Set([...source.matchAll(/"([a-z]+(?:_[a-z]+)+)"/g)].map((match) => match[1]))];
    assert.ok(events.length >= 11, `engine events found: ${events.join(", ")}`);
    for (const event of events) assert.ok(runtime.eventMessages[event], `missing message for ${event}`);
    const state = createInitialState();
    const telemetry = runtime.getTelemetry(state);
    assert.deepEqual(Object.keys(telemetry), ["system", "systemOnline", "cargo", "gate"]);
    assert.equal(telemetry.cargo, "0/3 CHECKED");
    assert.equal(telemetry.gate, "LOCKED");
    assert.equal(runtime.getTerminal(state).rows.length, 3);
    assert.equal(runtime.isCarrying(state), false);
    assert.deepEqual(runtime.getDebugState(state), { whiteboardReviewed: false, workstationChecked: false, airconOn: false, doorOpen: false });
    assert.equal(typeof runtime.createScene, "function");
    assert.equal(typeof runtime.syncVisuals, "function");
  });
});

test("the office scene is a self-contained procedural build with a graybox baseline root", async () => {
  const scene = await read("../game/levels/test_zpf2/scene.js");
  const props = await read("../game/levels/test_zpf2/props.js");
  const surfaces = await read("../game/levels/test_zpf2/surfaces.js");
  assert.match(SCENE_ROOT_NAME, /graybox_baseline/);
  assert.ok(PROCEDURAL_ASSETS.length > 0 && PROCEDURAL_ASSETS.every((asset) => asset.loaded), "app.js only enables start when at least one world asset reports loaded");
  assert.match(scene, /assetReady: Promise\.resolve\(PROCEDURAL_ASSETS/);
  assert.match(scene, /createSmallOfficeScene/);
  assert.match(scene, /syncSmallOfficeVisuals/);
  assert.doesNotMatch(scene + props + surfaces, /\.glb|GLTFLoader|local-assets/);
  for (const builder of ["buildDesk", "buildMonitor", "buildExecutiveChair", "buildVisitorChair", "buildCabinet", "buildPedestal", "buildSkull", "buildWhiteboard", "buildAirConditioner", "buildCot", "buildStorageCorner", "buildDoor"]) assert.match(props, new RegExp(`export function ${builder}\\(`));
  assert.match(surfaces, /createWoodFloorMaterial|createWhiteboardTexture|createBlindMaterial/);
});

test("test_zpf2 is registered as the twelfth scene across the app, HUD and agent entry points", async () => {
  const app = await read("../game/app.js");
  const html = await read("../index.html");
  const guideHtml = await read("../agent-guide.html");
  const guideJs = await read("../agent-guide.js");
  const platform = await read("../server/agent-platform.mjs");
  const mcp = await read("../tools/arc-opencode-mcp.mjs");
  const calibration = await read("./g1-motion-calibration.test.mjs");
  assert.match(app, /"rf10", "test_zpf", "test_zpf2"\]/);
  assert.match(app, /test_zpf2: \(\) => import\("\/game\/levels\/test_zpf2\/runtime\.js"\)/);
  assert.match(app, /test_zpf2: "完成小办公室巡检"/);
  assert.match(html, /data-level-option="test_zpf2"/);
  assert.ok(html.indexOf('data-level-option="test_zpf2"') > html.indexOf('data-level-option="test_zpf"'), "listed after the eleventh scene");
  assert.match(guideHtml, /data-agent-level="test_zpf2"/);
  assert.match(guideJs, /"test_zpf2"/);
  assert.match(platform, /"test_zpf2"/);
  assert.match(mcp, /"test_zpf2"/);
  assert.match(calibration, /test_zpf2\/level\.js/);
});
