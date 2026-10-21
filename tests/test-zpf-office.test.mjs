import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { CHECKPOINT_IDS, LEVEL } from "../game/levels/test_zpf/level.js";
import {
  createInitialState,
  getInteraction,
  interact,
  isWalkable,
  updateMovement,
} from "../game/levels/test_zpf/engine.js";
import * as runtime from "../game/levels/test_zpf/runtime.js";

function atCheckpoint(state, id) {
  return { ...state, player: { ...state.player, ...LEVEL.checkpoints[id] } };
}

function reachable(start, target, step = 0.18) {
  const key = (x, z) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const queue = [[start.x, start.z]];
  const visited = new Set([key(start.x, start.z)]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const [x, z] = queue[cursor];
    if (Math.hypot(x - target.x, z - target.z) <= step * 1.25) return true;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
      const next = [x + dx, z + dz];
      const nextKey = key(...next);
      if (visited.has(nextKey) || !isWalkable(null, ...next)) continue;
      visited.add(nextKey);
      queue.push(next);
    }
  }
  return false;
}

test("test_zpf defines a compact three-point office inspection", () => {
  assert.equal(LEVEL.id, "test_zpf");
  assert.deepEqual(CHECKPOINT_IDS, ["whiteboard", "workbench", "window_ac"]);
  const state = createInitialState();
  assert.deepEqual(state.inspected, { whiteboard: false, workbench: false, window_ac: false });
  assert.equal(state.complete, false);
});

test("office bounds, furniture, and approach anchors use the intended collision map", () => {
  assert.equal(isWalkable(null, 0.08, 0.35), false);
  assert.equal(isWalkable(null, 1.8, 2.6), false);
  assert.equal(isWalkable(null, 3.18, 1.72), false);
  CHECKPOINT_IDS.forEach((id) => assert.equal(isWalkable(null, LEVEL.checkpoints[id].x, LEVEL.checkpoints[id].z), true, id));
});

test("all three inspection anchors remain reachable from the door", () => {
  CHECKPOINT_IDS.forEach((id) => assert.equal(reachable(LEVEL.playerStart, LEVEL.checkpoints[id]), true, id));
});

test("the three checkpoints can be inspected in any order and complete immediately", () => {
  let state = createInitialState();
  for (const [index, id] of ["window_ac", "whiteboard", "workbench"].entries()) {
    state = atCheckpoint(state, id);
    assert.equal(getInteraction(state)?.checkpointId, id);
    state = interact(state);
    assert.equal(state.inspected[id], true);
    assert.equal(state.complete, index === 2);
  }
  assert.deepEqual(state.inspectionOrder, ["window_ac", "whiteboard", "workbench"]);
  assert.equal(state.lastEvent, "inspection_complete");
});

test("empty or repeated interaction does not create phantom progress", () => {
  let state = createInitialState();
  const untouched = interact(state);
  assert.equal(untouched.interactions, 0);
  state = interact(atCheckpoint(state, "whiteboard"));
  const repeated = interact(atCheckpoint(state, "whiteboard"));
  assert.equal(repeated.interactions, 1);
  assert.deepEqual(repeated.inspectionOrder, ["whiteboard"]);
});

test("movement uses the shared locomotion state and respects office obstacles", () => {
  const state = createInitialState();
  const moved = updateMovement(state, { move: 1, strafe: 0, turn: 0, drain: false }, 0.05);
  assert.notEqual(moved.player.z, state.player.z);
  assert.equal(moved.failed, false);
});

test("runtime and navigation surfaces register test_zpf as scene eleven", () => {
  [
    "createScene", "createInitialState", "updateMovement", "getInteraction", "interact",
    "closeTerminal", "syncVisuals", "isCarrying", "getTelemetry", "getTerminal",
    "getSoundPosition", "getDebugState",
  ].forEach((name) => assert.equal(typeof runtime[name], "function", name));
  assert.match(fs.readFileSync("game/app.js", "utf8"), /test_zpf:\s*\(\) => import\("\/game\/levels\/test_zpf\/runtime\.js"\)/);
  assert.match(fs.readFileSync("index.html", "utf8"), /data-level-option="test_zpf"/);
  assert.match(fs.readFileSync("agent-guide.html", "utf8"), /data-agent-level="test_zpf"/);
  assert.match(fs.readFileSync("agent-guide.js", "utf8"), /"test_zpf"/);
});
