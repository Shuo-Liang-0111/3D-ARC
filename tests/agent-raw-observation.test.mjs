import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { EXTERNAL_AGENT_ACTIONS, EXTERNAL_AGENT_ACTION_DESCRIPTIONS } from "../game/agent-actions.js";

const source = await readFile(new URL("../game/app.js", import.meta.url), "utf8");
const captureCode = source.slice(source.indexOf("function requireViewportCapture("), source.indexOf("\nfunction captureRenderFrame("));
const observationCode = source.slice(source.indexOf("function externalAgentStatus("), source.indexOf("\nasync function startEpisodeBridge("));
const bridgeCode = source.slice(source.indexOf("async function startEpisodeBridge("), source.indexOf("\nvoid startEpisodeBridge("));
// Actual PNG bytes, not a MIME-only placeholder.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII=";
const SECOND_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const STOP = new Error("mock bridge complete");

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function fixture({ harness = "visual", binding = async () => PNG } = {}) {
  const calls = { captures: 0, frames: 0, acts: [], resets: 0, requests: [], submissions: [] };
  const state = {
    player: { x: 1, z: 2, yaw: 0 }, motion: { alpha: "idle", beta: "idle" },
    progress: 100, interactions: 0, complete: false, failed: false, lastEvent: "fixture_initial",
  };
  const interaction = { label: "Visible fixture target", target: { marker: "before" } };
  const context = vm.createContext({
    Math, Date, Promise, structuredClone, URLSearchParams,
    EXTERNAL_AGENT_ACTIONS, EXTERNAL_AGENT_ACTION_DESCRIPTIONS,
    EXTERNAL_AGENT_HARNESSES: ["visual", "hybrid", "state"],
    state, levelId: "fixture", viewMode: "dual", running: true,
    episodeEnvironment: { protocolVersion: "arc-seed-v1", seed: null, seedPolicy: "fixed", seedApplied: false, initialStateFingerprint: null },
    robotAssetsLoaded: true, robotAssetsFailed: false,
    cumulativeReserveSpent: 0, externalAgentAction: Promise.resolve(),
    gameShell: { dataset: {} },
    searchParams: new URLSearchParams({ episode: "mock-only", browser_token: "mock-only", harness }),
    window: {},
    // Raw capture must not create a canvas, access the renderer, or change layout.
    document: new Proxy({}, { get() { assert.fail("raw capture accessed the DOM"); } }),
    renderer: new Proxy({}, { get() { assert.fail("raw capture accessed the renderer"); } }),
    renderViews() { assert.fail("raw capture rendered an alternative frame"); },
    runtime: {
      LEVEL: { progress: { interactionCost: 0 } },
      getInteraction: () => interaction,
      getDebugState: (value) => ({ playerX: value.player.x }),
    },
    hudObservation: () => ({ objective: "Visible fixture", cargo: "fixture cargo" }),
    waitForFrameSync: async () => { calls.frames += 1; },
    startGame() { context.running = true; },
    resetSimulation() {
      calls.resets += 1;
      context.state.player = { x: 0, z: 0, yaw: 0 };
    },
    executeAgentAction: async (action, durationMs) => {
      calls.acts.push({ action, durationMs });
      context.state.player.x += 1;
      context.state.lastEvent = "fixture_acted";
    },
    delay: async () => {},
    fetch: async () => { assert.fail("unexpected mock fetch"); },
  });
  if (binding) context.window.__ARC_CAPTURE_VIEWPORT__ = async () => {
    calls.captures += 1;
    return binding(calls.captures, context);
  };
  vm.runInContext(captureCode + "\n" + observationCode + "\n" + bridgeCode, context);
  return { context, calls, interaction };
}

test("raw observation awaits the binding and passes through its exact PNG bytes", async () => {
  const gate = deferred();
  const entered = deferred();
  const { context, calls } = fixture({ binding: () => { entered.resolve(); return gate.promise; } });
  let settled = false;
  const observationPromise = context.window.__ARC_AGENT__.observe("visual").then((value) => { settled = true; return value; });
  await entered.promise;
  assert.equal(calls.captures, 1);
  assert.equal(settled, false);
  gate.resolve(PNG);
  const observation = await observationPromise;
  assert.equal(observation.screenshot, PNG);
  assert.equal(JSON.parse(JSON.stringify(observation)).screenshot, PNG);
  assert.equal(calls.frames, 1);
  assert.equal("player" in observation, false);
  assert.equal("debug" in observation, false);
});

test("missing capture capability rejects capture, visual actions and reset before side effects", async () => {
  const { context, calls } = fixture({ binding: null });
  await assert.rejects(context.captureFrame(), /原始视口截图不可用/);
  await assert.rejects(context.window.__ARC_AGENT__.observe("visual"), /原始视口截图不可用/);
  await assert.rejects(context.window.__ARC_AGENT__.act({ action: "W", durationMs: 100, harness: "visual" }), /原始视口截图不可用/);
  assert.throws(() => context.window.__ARC_AGENT__.reset({ harness: "hybrid" }), /原始视口截图不可用/);
  assert.equal(calls.frames, 0);
  assert.equal(calls.acts.length, 0);
  assert.equal(calls.resets, 0);
  await context.startEpisodeBridge();
  assert.match(context.gameShell.dataset.agentBridgeError, /原始视口截图不可用/);
  assert.equal(calls.requests.length, 0);
});

test("capture rejects missing, malformed and non-PNG responses without a synthetic fallback", async () => {
  for (const value of [undefined, null, "", {}, "data:image/jpeg;base64,/9j/AA==", "data:image/png;base64,", "data:image/png;base64,not!base64", "data:image/png;base64,/9j/AA==", "data:image/png;base64,YXJj"]) {
    const { context, calls } = fixture({ binding: async () => value });
    await assert.rejects(context.captureFrame(), /PNG/);
    assert.equal(calls.captures, 1);
  }
});

test("state observation, action and reset need no screenshot hook", async () => {
  const { context, calls } = fixture({ harness: "state", binding: null });
  const initial = await context.window.__ARC_AGENT__.observe("state");
  assert.equal(initial.state.player.x, 1);
  assert.equal("screenshot" in initial, false);
  const acted = await context.window.__ARC_AGENT__.act({ action: "W", durationMs: 175.5, harness: "state" });
  assert.equal(acted.state.player.x, 2);
  const reset = await context.window.__ARC_AGENT__.reset({ harness: "state" });
  assert.equal(reset.state.player.x, 0);
  assert.equal(calls.acts.length, 1);
  assert.equal(calls.resets, 1);
  assert.equal(calls.captures, 0);
  assert.equal(calls.frames, 0);
});

test("all hybrid metadata is an independent snapshot before asynchronous PNG capture", async () => {
  const gate = deferred();
  const { context, interaction } = fixture({ harness: "hybrid", binding: () => gate.promise });
  const pending = context.createExternalAgentObservation("hybrid");
  await Promise.resolve();
  context.state.player.x = 99;
  context.state.motion.alpha = "moving";
  interaction.target.marker = "after";
  gate.resolve(PNG);
  const observation = await pending;
  assert.equal(observation.player.x, 1);
  assert.equal(observation.debug.playerX, 1);
  assert.equal(observation.motion.alpha, "idle");
  assert.equal(observation.interaction.target.marker, "before");
  assert.equal(observation.screenshot, PNG);
});

async function runBridge({ commands = [], captureFailures = [], submissionFailures = [] } = {}) {
  const failureCalls = new Set(captureFailures);
  const { context, calls } = fixture({
    binding: async (number) => {
      if (failureCalls.has(number)) throw new Error("mock capture failed");
      return number % 2 ? PNG : SECOND_PNG;
    },
  });
  let commandIndex = 0;
  let submissionIndex = 0;
  let finished = false;
  context.fetch = async (url, options = {}) => {
    calls.requests.push({ url, method: options.method || "GET" });
    if (url.includes("/observations?")) {
      submissionIndex += 1;
      const payload = JSON.parse(options.body);
      calls.submissions.push(payload);
      if (submissionFailures.includes(submissionIndex)) throw new Error("mock upload failed");
      return { ok: true, status: 200, json: async () => ({ accepted: true }) };
    }
    assert.ok(url.includes("/commands/next?"), url);
    if (commandIndex < commands.length) return { ok: true, status: 200, json: async () => commands[commandIndex++] };
    finished = true;
    return { ok: true, status: 204 };
  };
  context.delay = async () => {
    // Break only the mock's idle loop, after every expected command was acknowledged.
    if (finished) throw STOP;
    assert.ok(calls.requests.length < 30 && calls.captures < 20, "retry loop exceeded fixture bounds");
  };
  await assert.rejects(context.startEpisodeBridge(), (error) => error === STOP);
  return calls;
}

test("initial capture failure retries PNG capture without issuing an action", async () => {
  const calls = await runBridge({ captureFailures: [1] });
  assert.equal(calls.captures, 2);
  assert.equal(calls.submissions.length, 1);
  assert.equal(calls.submissions[0].observation.screenshot, SECOND_PNG);
  assert.equal(calls.acts.length, 0);
  assert.equal(calls.resets, 0);
});

test("bridge capture retries never repeat an executed act or reset", async () => {
  for (const command of [
    { id: "mock-act", kind: "act", payload: { action: "W", durationMs: 275.5 } },
    { id: "mock-reset", kind: "reset", payload: {} },
  ]) {
    const calls = await runBridge({ commands: [command], captureFailures: [2] });
    assert.equal(calls.captures, 3);
    assert.equal(calls.submissions.length, 2);
    assert.equal(calls.submissions[1].commandId, command.id);
    assert.equal(calls.submissions[1].observation.screenshot, PNG);
    assert.equal(calls.acts.length, command.kind === "act" ? 1 : 0);
    assert.equal(calls.resets, command.kind === "reset" ? 1 : 0);
    assert.equal(calls.requests.filter(({ url }) => url.includes("/commands/next?")).length, 2);
  }
});

test("bridge upload retries reuse the same captured PNG and metadata", async () => {
  const command = { id: "mock-act", kind: "act", payload: { action: "W", durationMs: 275.5 } };
  const calls = await runBridge({ commands: [command], submissionFailures: [1, 3] });
  assert.equal(calls.captures, 2);
  assert.equal(calls.acts.length, 1);
  assert.equal(calls.submissions.length, 4);
  assert.deepEqual(calls.submissions[0], calls.submissions[1]);
  assert.deepEqual(calls.submissions[2], calls.submissions[3]);
  assert.equal(calls.submissions[0].observation.screenshot, PNG);
  assert.equal(calls.submissions[2].observation.screenshot, SECOND_PNG);
  assert.equal(calls.submissions[2].commandId, command.id);
});
