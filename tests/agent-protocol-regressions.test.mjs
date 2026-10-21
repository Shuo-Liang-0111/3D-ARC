import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AgentPlatformStore } from "../server/agent-platform.mjs";
import { ArcAgentClient } from "../tools/arc-agent-client.mjs";

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "arc-protocol-regression-"));
  const store = new AgentPlatformStore({ root });
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  const created = store.createEpisode({ level: "rf01", harness: "visual", view: "dual", engine: "tool" });
  const id = created.episode.id;
  const browserToken = new URL(created.gameUrl).searchParams.get("browser_token");
  async function act(action, event, extra = {}) {
    const command = store.enqueueCommand(id, created.agentToken, { kind: "act", action, durationMs: 775 });
    store.nextCommand(id, browserToken);
    await store.submitObservation(id, browserToken, {
      harness: "visual", status: "NOT_FINISHED",
      actionResult: { action, event }, ...extra,
    }, command.id);
    return store.getStatus(id, created.agentToken);
  }
  return { store, created, id, browserToken, act };
}

test("turn commands and public action meanings survive the visual protocol", async t => {
  const { store, created, id, browserToken, act } = await fixture(t);
  const actionDescriptions = { A: "Strafe left", D: "Strafe right", E: "Interact", TURN_LEFT: "Turn left", TURN_RIGHT: "Turn right" };
  await store.submitObservation(id, browserToken, {
    harness: "visual", status: "NOT_FINISHED", availableActions: Object.keys(actionDescriptions), actionDescriptions,
    judge: { completedProcessTasks: 3, totalProcessTasks: 3 },
    player: { x: 999 }, debug: { hidden: true }, actionResult: { action: "E", event: "invalid_interaction" },
  });
  const observed = await store.getLatestObservation(id, created.agentToken);
  assert.deepEqual(observed.actionDescriptions, actionDescriptions);
  assert.equal(observed.judge, undefined);
  assert.equal(observed.player, undefined);
  assert.equal(observed.debug, undefined);
  await act("TURN_LEFT", "executed");
  await act("TURN_RIGHT", "executed");
  assert.equal(store.getStatus(id, created.agentToken).stepCount, 2);
});

test("failed and repeated interactions cannot manufacture process completion", async t => {
  const { store, id, created, act } = await fixture(t);
  const fakeCounter = { judge: { completedProcessTasks: 3, totalProcessTasks: 3 } };
  for (const event of ["invalid_interaction", "no_interaction", "terminal_opened", "invalid_interaction"]) {
    const result = await act("E", event, fakeCounter);
    assert.equal(result.processScore, 0);
    assert.deepEqual(result.processTasks, []);
  }
  let result = await act("E", "battery_collected", fakeCounter);
  assert.equal(result.processScore, 33.33);
  result = await act("E", "battery_collected", fakeCounter);
  assert.equal(result.processScore, 33.33);
  assert.deepEqual(result.processTasks, ["battery_collected"]);
  // A task-like event attached to a movement command cannot score an interaction.
  result = await act("TURN_LEFT", "power_restored", fakeCounter);
  assert.equal(result.processScore, 33.33);
  result = await act("E", "power_restored");
  assert.equal(result.processScore, 66.67);
  result = await act("E", "door_opened");
  assert.equal(result.processScore, 100);
  assert.deepEqual(result.processTasks, ["battery_collected", "power_restored", "door_opened"]);
  assert.equal(store.getResult(id, created.agentToken).ready, false);
});


test("HTTP command durations reject coercion and preserve the model-selected interval", async t => {
  const { store, created, id, browserToken } = await fixture(t);
  for (const durationMs of [null, false, true, "", "775", "bad", NaN, Infinity, -Infinity, -1, 0, 49, 1001]) {
    assert.throws(
      () => store.enqueueCommand(id, created.agentToken, { kind: "act", action: "TURN_LEFT", durationMs }),
      /durationMs/,
    );
    assert.equal(store.getStatus(id, created.agentToken).activeCommand, null);
  }
  for (const durationMs of [undefined, 50, 775.5, 1000]) {
    const expected = durationMs === undefined ? 300 : durationMs;
    const command = store.enqueueCommand(id, created.agentToken, { kind: "act", action: "TURN_LEFT", durationMs });
    assert.equal(command.payload.durationMs, expected);
    assert.equal(store.nextCommand(id, browserToken).payload.durationMs, expected);
    await store.submitObservation(id, browserToken, {
      harness: "visual", status: "NOT_FINISHED", actionResult: { action: "TURN_LEFT", event: "executed" },
    }, command.id);
  }
});


test("generic client rejects invalid durations before sending and preserves fractional timing", async () => {
  const submitted = [];
  const client = new ArcAgentClient({ baseUrl: "http://arc.test", fetchImpl: async (url, options) => {
    if (url.endsWith("/commands")) {
      submitted.push(JSON.parse(options.body));
      return { ok: true, status: 202, json: async () => ({ id: "command" }) };
    }
    return { ok: true, status: 200, json: async () => ({ commandId: "command", status: "NOT_FINISHED" }) };
  } });
  for (const durationMs of [null, false, true, "", "775", NaN, Infinity, 0, 49, 1001]) {
    await assert.rejects(client.act("episode", "test-token", "TURN_LEFT", { durationMs }), /durationMs/);
  }
  assert.equal(submitted.length, 0);
  for (const durationMs of [undefined, 50, 775.5, 1000]) {
    await client.act("episode", "test-token", "TURN_LEFT", { durationMs });
  }
  assert.deepEqual(submitted.map(command => command.durationMs), [300, 50, 775.5, 1000]);
});
