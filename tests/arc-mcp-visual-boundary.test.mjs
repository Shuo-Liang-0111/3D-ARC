import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../tools/arc-opencode-mcp.mjs", import.meta.url), "utf8");
const body = source.slice(source.indexOf("let currentEpisode = null;"), source.indexOf("\nfunction send("));
const HIDDEN = "SERVER_ONLY_CHECKPOINT";
const MEMORY_KEY = "arcVisualAgentMemoryV1";
const decode = (content) => JSON.parse(content.find((item) => item.type === "text").text);

function fixture(harness = "visual") {
  let memory = { goal: HIDDEN, recentEvents: [HIDDEN], lastEvent: HIDDEN, step: 87 };
  const writes = [];
  const acts = [];
  const episode = {
    id: "fixture", level: "rf01", view: "dual", harness, status: "running", stepCount: 0,
    processScore: 100, processTasks: [HIDDEN], energyRemaining: 7,
    memory, privateFutureField: HIDDEN,
  };
  const observation = {
    // A mislabeled response cannot relax an episode's visual boundary.
    harness: "hybrid", status: "NOT_FINISHED", ready: true, step: 0,
    availableActions: ["W", "A", "S", "D", "E", "WAIT", "TURN_LEFT", "TURN_RIGHT"],
    actionDescriptions: { A: "Strafe left", E: "Interact", TURN_LEFT: "Turn left" },
    screenshot: "data:image/png;base64,YXJj", hud: { cargo: HIDDEN },
    player: { x: HIDDEN }, debug: { secret: HIDDEN }, actionResult: { event: HIDDEN }, judge: { secret: HIDDEN },
  };
  const client = {
    async createEpisode() { return { episode: structuredClone(episode), agentToken: "fixture-token", gameUrl: "http://example.invalid/?episode=fixture" }; },
    async status() { return { ...structuredClone(episode), activeCommand: { id: "command-fixture", status: "pending", kind: "act", extra: HIDDEN } }; },
    async observe() { return structuredClone(observation); },
    async reset() { return structuredClone(observation); },
    async act(id, token, action, options) { acts.push({ action, ...options }); return structuredClone(observation); },
    async memory() { return structuredClone(memory); },
    async updateMemory(id, token, patch) {
      writes.push(structuredClone(patch));
      memory = { ...memory, ...structuredClone(patch), lastEvent: HIDDEN, recentEvents: [HIDDEN], step: 88 };
      return structuredClone(memory);
    },
  };
  const context = vm.createContext({
    client, managedBrowser: { async close() {}, async open() {} },
    structuredClone, process: { env: {} }, setTimeout,
  });
  vm.runInContext(body + "\nthis.callTool = callTool;", context);
  return { call: context.callTool, client, writes, acts };
}

test("visual MCP start and status expose infrastructure only", async () => {
  const { call } = fixture();
  const started = decode(await call("start_episode", { harness: "visual" }));
  assert.equal(started.episode.harness, "visual");
  assert.equal(started.episode.id, "fixture");
  assert.equal(started.gameUrl, "http://example.invalid/?episode=fixture");
  assert.equal(JSON.stringify(started).includes(HIDDEN), false);
  for (const field of ["processScore", "processTasks", "energyRemaining", "memory", "privateFutureField"]) assert.equal(field in started.episode, false);
  const status = decode(await call("get_status"));
  assert.equal(status.status, "running");
  assert.deepEqual(status.activeCommand, { id: "command-fixture", kind: "act", status: "pending" });
  assert.equal(JSON.stringify(status).includes(HIDDEN), false);
});

test("visual MCP observe, act and reset cannot be relaxed by response harness metadata", async () => {
  const { call, acts } = fixture();
  await call("start_episode", { harness: "visual" });
  for (const [name, args] of [["observe", {}], ["act", { action: "TURN_LEFT", durationMs: 775.5 }], ["reset", {}]]) {
    const content = await call(name, args);
    const observed = decode(content);
    assert.equal(observed.harness, "visual");
    assert.equal(JSON.stringify(observed).includes(HIDDEN), false);
    assert.equal(observed.actionDescriptions.E, "Interact");
    assert.ok(content.some((item) => item.type === "image"));
  }
  assert.deepEqual(acts, [{ action: "TURN_LEFT", durationMs: 775.5 }]);
});

test("visual MCP memory only recalls and merges model-authored values", async () => {
  const { call, writes } = fixture();
  await call("start_episode", { harness: "visual" });
  assert.deepEqual(decode(await call("recall_memory")), {});
  assert.deepEqual(decode(await call("update_memory", { memory: { goal: "My visual plan", step: "my count" } })), { goal: "My visual plan", step: "my count" });
  assert.deepEqual(decode(await call("update_memory", { memory: { landmark: "My observed landmark" } })), { goal: "My visual plan", step: "my count", landmark: "My observed landmark" });
  const recalled = decode(await call("recall_memory"));
  assert.equal(recalled.goal, "My visual plan");
  assert.equal(recalled.step, "my count");
  assert.equal(JSON.stringify(recalled).includes(HIDDEN), false);
  assert.deepEqual(Object.keys(writes[0]), [MEMORY_KEY]);
  assert.equal(writes[1][MEMORY_KEY].landmark, "My observed landmark");
  await assert.rejects(call("update_memory", { memory: [] }), /对象/);
  assert.equal(writes.length, 2);
});

test("hybrid and state MCP keep their structured status and memory behavior", async () => {
  for (const harness of ["hybrid", "state"]) {
    const { call, writes } = fixture(harness);
    const started = decode(await call("start_episode", { harness }));
    assert.equal(started.episode.processScore, 100);
    assert.equal(decode(await call("get_status")).memory.goal, HIDDEN);
    assert.equal(decode(await call("observe")).debug.secret, HIDDEN);
    assert.equal(decode(await call("recall_memory")).lastEvent, HIDDEN);
    const updated = decode(await call("update_memory", { memory: { goal: "Own structured plan" } }));
    assert.equal(updated.lastEvent, HIDDEN);
    assert.deepEqual(writes[0], { goal: "Own structured plan" });
  }
});

test("MCP rejects invalid durations without issuing an action", async () => {
  const { call, acts } = fixture();
  await call("start_episode", { harness: "visual" });
  for (const durationMs of [undefined, null, false, true, "", "775", "bad", NaN, Infinity, -Infinity, -1, 0, 49, 1001]) {
    await assert.rejects(call("act", { action: "TURN_LEFT", durationMs }), /durationMs/);
  }
  assert.equal(acts.length, 0);
});


test("a pending visual observation keeps its boundary when another episode starts", async () => {
  const { call, client } = fixture();
  await call("start_episode", { harness: "visual" });
  const originalObserve = client.observe;
  let resolveObservation;
  client.observe = () => new Promise((resolve) => { resolveObservation = resolve; });
  const pending = call("observe");
  await call("start_episode", { harness: "hybrid" });
  resolveObservation(await originalObserve());
  const observed = decode(await pending);
  assert.equal(observed.harness, "visual");
  assert.equal(JSON.stringify(observed).includes(HIDDEN), false);
});
