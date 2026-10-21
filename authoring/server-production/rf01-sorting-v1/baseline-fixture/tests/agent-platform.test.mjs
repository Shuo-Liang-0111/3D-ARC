import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AgentPlatformStore } from "../server/agent-platform.mjs";

test("agent platform isolates tokens and persists commands, observations, and memory", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "arc-agent-platform-"));
  const store = new AgentPlatformStore({ root });
  context.after(() => store.close());

  const created = store.createEpisode({ level: "rf01", view: "dual", harness: "hybrid", gameBaseUrl: "http://example.test:4175/" });
  assert.match(created.gameUrl, /level=rf01/);
  assert.match(created.gameUrl, /harness=hybrid/);
  assert.doesNotMatch(JSON.stringify(created.episode), /token/i);
  assert.throws(() => store.getStatus(created.episode.id, "wrong"), /Token/);

  const gameUrl = new URL(created.gameUrl);
  const browserToken = gameUrl.searchParams.get("browser_token");
  await store.submitObservation(created.episode.id, browserToken, {
    status: "NOT_FINISHED",
    harness: "hybrid",
    hud: { objective: "恢复园区供电" },
    screenshot: "data:image/jpeg;base64,YXJj",
  });
  const initial = await store.getLatestObservation(created.episode.id, created.agentToken);
  assert.equal(initial.step, 0);
  assert.equal(initial.screenshot, "data:image/jpeg;base64,YXJj");

  const command = store.enqueueCommand(created.episode.id, created.agentToken, { kind: "act", action: "w", durationMs: 300 });
  assert.equal(store.nextCommand(created.episode.id, browserToken).payload.action, "W");
  await store.submitObservation(created.episode.id, browserToken, {
    status: "NOT_FINISHED",
    harness: "hybrid",
    hud: { objective: "恢复园区供电" },
    actionResult: { action: "W", event: "executed" },
  }, command.id);
  const observation = await store.getLatestObservation(created.episode.id, created.agentToken);
  assert.equal(observation.commandId, command.id);
  assert.equal(observation.step, 1);

  const memory = store.updateMemory(created.episode.id, created.agentToken, { completed: ["reached gate"], nextPlan: "find battery" });
  assert.deepEqual(memory.completed, ["reached gate"]);
  assert.equal(store.getStatus(created.episode.id, created.agentToken).stepCount, 1);
  const trajectory = await readFile(join(root, "episodes", created.episode.id, "trajectory.jsonl"), "utf8");
  assert.equal(trajectory.trim().split("\n").length, 2);
});

test("agent platform validates harnesses and serializes commands", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "arc-agent-platform-"));
  const store = new AgentPlatformStore({ root });
  context.after(() => store.close());
  assert.throws(() => store.createEpisode({ harness: "unknown" }), /Harness/);
  const created = store.createEpisode({ harness: "state" });
  store.enqueueCommand(created.episode.id, created.agentToken, { kind: "act", action: "WAIT" });
  assert.throws(() => store.enqueueCommand(created.episode.id, created.agentToken, { kind: "act", action: "W" }), /尚未完成/);
});

test("agent platform redelivers expired commands and accepts duplicate results", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "arc-agent-platform-"));
  const store = new AgentPlatformStore({ root, commandLeaseMs: 10 });
  context.after(() => store.close());

  const created = store.createEpisode({ harness: "visual" });
  const browserToken = new URL(created.gameUrl).searchParams.get("browser_token");
  const command = store.enqueueCommand(created.episode.id, created.agentToken, { kind: "act", action: "D" });
  const firstDispatch = store.nextCommand(created.episode.id, browserToken);
  assert.equal(firstDispatch.id, command.id);
  assert.equal(firstDispatch.redelivered, false);
  assert.equal(store.nextCommand(created.episode.id, browserToken), null);

  store.db.prepare("UPDATE commands SET dispatched_at = ? WHERE id = ?").run("2000-01-01T00:00:00.000Z", command.id);
  const retryDispatch = store.nextCommand(created.episode.id, browserToken);
  assert.equal(retryDispatch.id, command.id);
  assert.equal(retryDispatch.redelivered, true);
  assert.equal(retryDispatch.dispatchCount, 2);

  const result = {
    status: "NOT_FINISHED",
    harness: "visual",
    hud: { objective: "恢复园区供电" },
    actionResult: { action: "D", event: "executed" },
  };
  const accepted = await store.submitObservation(created.episode.id, browserToken, result, command.id);
  const duplicate = await store.submitObservation(created.episode.id, browserToken, result, command.id);
  assert.equal(accepted.step, 1);
  assert.equal(duplicate.step, 1);
  assert.equal(duplicate.duplicate, true);
  assert.equal(store.getStatus(created.episode.id, created.agentToken).activeCommand, null);
  const trajectory = await readFile(join(root, "episodes", created.episode.id, "trajectory.jsonl"), "utf8");
  assert.equal(trajectory.trim().split("\n").length, 1);
});
