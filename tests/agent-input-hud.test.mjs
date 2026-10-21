import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { EXTERNAL_AGENT_ACTIONS, EXTERNAL_AGENT_ACTION_DESCRIPTIONS, externalAgentMovementInput } from "../game/agent-actions.js";
import { applyRobotMovement } from "../game/movement.js";

const source = await readFile(new URL("../game/app.js", import.meta.url), "utf8");
const actionCode = source.slice(source.indexOf("async function executeAgentAction("), source.indexOf("\nfunction startGame("));
const observationCode = source.slice(source.indexOf("function externalAgentStatus("), source.indexOf("\nwindow.__ARC_AGENT__"));

function fixture() {
  const level = { moveSpeed: 2, turnSpeed: 1, progress: { interactionCost: 0 } };
  const context = vm.createContext({
    Math, Date, Promise, structuredClone,
    EXTERNAL_AGENT_ACTIONS, EXTERNAL_AGENT_ACTION_DESCRIPTIONS, externalAgentMovementInput,
    EXTERNAL_AGENT_HARNESSES: ["visual", "hybrid", "state"],
    running: true, robotAssetsLoaded: true, robotAssetsFailed: false,
    episodeEnvironment: { protocolVersion: "arc-seed-v1", seed: null, seedPolicy: "fixed", seedApplied: false, initialStateFingerprint: null },
    state: { player: { x: 0, z: 0, yaw: 0 }, progress: 100, interactions: 0, complete: false, failed: false },
    runtime: {
      LEVEL: level,
      updateMovement(state, input, dt) {
        const next = { ...state, player: { ...state.player } };
        applyRobotMovement(next, state, input, dt, level, () => true);
        const moved = Math.hypot(next.player.x - state.player.x, next.player.z - state.player.z);
        next.progress -= moved + (input.drain === false ? 0 : Math.abs(input.turn || 0));
        return next;
      },
      getDebugState: () => ({ confidential: "not visual input" }),
      getInteraction: () => ({ confidential: "not visual input" }),
    },
    requireViewportCapture() {},
    externalSimulation: false, mujocoEnabled: false, controlModeId: "velocity",
    robot: { position: { set() {} }, rotation: {} }, robotGroundY: 0,
    cumulativeReserveSpent: 0, gaitDistance: 0, robotAction: {},
    isRobotActionActive: () => false, updateInterface() {},
    delay: async () => {}, waitForFrameSync: async () => {},
    performInteraction: () => {}, levelId: "fixture", viewMode: "third",
    hudObservation: () => ({ objective: "Synthetic test" }), captureFrame: () => "synthetic image",
  });
  context.performInteraction = () => {
    context.state.interactions += 1;
    context.state.lastEvent = "repeated_or_unsuccessful_interaction";
  };
  vm.runInContext(actionCode + "\n" + observationCode, context);
  return context;
}

test("semantic turns change heading without translating or charging reserve", async () => {
  const context = fixture();
  for (const [action, sign] of [["TURN_LEFT", 1], ["TURN_RIGHT", -1]]) {
    const before = structuredClone(context.state);
    const observation = await context.executeExternalAgentAction(action, 500, "hybrid");
    assert.ok(Math.abs(context.state.player.yaw - before.player.yaw - sign * 0.5) < 1e-8);
    assert.equal(context.state.player.x, before.player.x);
    assert.equal(context.state.player.z, before.player.z);
    assert.equal(context.state.progress, before.progress);
    assert.equal(observation.actionResult.moved, 0);
    assert.ok(observation.actionResult.turned > 0);
  }
  assert.equal(context.cumulativeReserveSpent, 0);
});

test("W/S translate forward/back and A/D strafe without changing heading", async () => {
  for (const [action, x, z] of [["W", 0, 0.4], ["S", 0, -0.4], ["A", 0.4, 0], ["D", -0.4, 0]]) {
    const context = fixture();
    await context.executeExternalAgentAction(action, 200, "hybrid");
    assert.ok(Math.abs(context.state.player.x - x) < 1e-8);
    assert.ok(Math.abs(context.state.player.z - z) < 1e-8);
    assert.equal(context.state.player.yaw, 0);
    assert.ok(context.state.progress < 100);
  }
});

test("legacy E still interacts, WAIT does not, and repeated interactions do not publish judge progress", async () => {
  const context = fixture();
  for (let index = 0; index < 5; index += 1) {
    const observation = await context.executeExternalAgentAction("E", 100, "visual");
    assert.equal(context.state.interactions, index + 1);
    assert.equal(observation.actionResult.action, "E");
    assert.equal(observation.actionResult.event, "repeated_or_unsuccessful_interaction");
    assert.equal(context.state.player.yaw, 0);
    assert.equal("judge" in observation, false);
    assert.equal("completedProcessTasks" in observation, false);
    assert.equal("debug" in observation, false);
    assert.equal("player" in observation, false);
    assert.equal("interaction" in observation, false);
    assert.deepEqual(Object.keys(observation.actionDescriptions).sort(), [...observation.availableActions].sort());
  }
  await context.executeExternalAgentAction("WAIT", 100, "visual");
  assert.equal(context.state.interactions, 5);
  await assert.rejects(context.executeExternalAgentAction("F", 100), /非法动作/);
  assert.equal(context.state.interactions, 5);
});

test("browser action boundary rejects invalid durations before applying input", async () => {
  const context = fixture();
  for (const durationMs of [null, false, true, "", "775", "bad", NaN, Infinity, -Infinity, -1, 0, 49, 1001]) {
    await assert.rejects(context.executeExternalAgentAction("TURN_LEFT", durationMs, "visual"), /durationMs/);
    assert.equal(context.state.player.yaw, 0);
    assert.equal(context.state.interactions, 0);
  }
  const defaulted = await context.executeExternalAgentAction("WAIT", undefined, "visual");
  assert.equal(defaulted.actionResult.durationMs, 300);
  const precise = await context.executeExternalAgentAction("TURN_LEFT", 775.5, "visual");
  assert.equal(precise.actionResult.durationMs, 775.5);
  assert.ok(Math.abs(context.state.player.yaw - 0.7755) < 1e-8);
});
