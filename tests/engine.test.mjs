import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTION,
  STATUS,
  efficiencyScore,
  recordingToJsonl,
  renderFrame,
  startState,
  step,
} from "../legacy/game/engine.js";

function play(actions) {
  return actions.reduce((state, action) => step(state, action), startState());
}

test("initial environment is deterministic and exposes a 64x64 indexed frame", () => {
  const state = startState();
  const frame = renderFrame(state);
  assert.equal(state.player.x, 1);
  assert.equal(state.player.y, 9);
  assert.equal(frame.length, 4096);
  assert.ok([...frame].every((value) => value >= 0 && value <= 15));
});

test("cyan gate blocks the player until channel 01 is acquired", () => {
  const blocked = play([
    ACTION.UP, ACTION.UP, ACTION.UP, ACTION.UP, ACTION.UP,
    ACTION.RIGHT, ACTION.RIGHT, ACTION.RIGHT,
  ]);
  assert.deepEqual(blocked.player, { x: 3, y: 4 });
  assert.equal(blocked.lastEvent, "gate_resists");

  const opened = play([
    ACTION.UP, ACTION.UP, ACTION.RIGHT,
    ACTION.UP, ACTION.UP, ACTION.UP,
    ACTION.RIGHT, ACTION.RIGHT,
  ]);
  assert.equal(opened.signals.cyan, true);
  assert.deepEqual(opened.player, { x: 4, y: 4 });
});

test("the optimal route acquires both signals and reaches the terminal in 16 actions", () => {
  const actions = [
    ACTION.UP, ACTION.UP, ACTION.RIGHT,
    ACTION.UP, ACTION.UP, ACTION.UP,
    ACTION.RIGHT, ACTION.RIGHT,
    ACTION.RIGHT, ACTION.RIGHT, ACTION.RIGHT,
    ACTION.UP,
    ACTION.UP, ACTION.UP,
    ACTION.RIGHT, ACTION.RIGHT,
  ];
  const state = play(actions);
  assert.equal(state.status, STATUS.WIN);
  assert.equal(state.actions, 16);
  assert.deepEqual(state.signals, { cyan: true, magenta: true });
  assert.ok(Math.abs(efficiencyScore(state) - 115) < Number.EPSILON * 100);
});

test("recordings are newline-delimited JSON with the current frame", () => {
  const initial = startState();
  const moved = step(initial, ACTION.UP);
  const jsonl = recordingToJsonl([
    { timestamp: "2026-01-01T00:00:00.000Z", action: ACTION.RESET, actionName: "RESET", state: initial },
    { timestamp: "2026-01-01T00:00:01.000Z", action: ACTION.UP, actionName: "UP", state: moved },
  ]);
  const lines = jsonl.split("\n").map(JSON.parse);
  assert.equal(lines.length, 2);
  assert.equal(lines[1].data.frame[0].length, 64);
  assert.equal(lines[1].data.frame[0][0].length, 64);
});
