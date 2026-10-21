import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AgentPlatformStore } from "../server/agent-platform.mjs";

test("leaderboard reports success rates across fixed 1, 5, and 10 episode windows", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "arc-attempt-leaderboard-"));
  const store = new AgentPlatformStore({ root });
  context.after(() => store.close());

  async function finish(agentName, terminalStatus, energySpent = 0) {
    const created = store.createEpisode({
      level: "rf01",
      harness: "visual",
      view: "dual",
      engine: "tool",
      agent: { name: agentName, version: "1" },
      model: "vision-model",
    });
    const browserToken = new URL(created.gameUrl).searchParams.get("browser_token");
    await store.submitObservation(created.episode.id, browserToken, { status: "NOT_FINISHED", harness: "visual", hud: { reserve: 100, energySpent: 0 } });
    const command = store.enqueueCommand(created.episode.id, created.agentToken, { kind: "act", action: "WAIT" });
    store.nextCommand(created.episode.id, browserToken);
    await store.submitObservation(created.episode.id, browserToken, { status: terminalStatus, harness: "visual", hud: { reserve: 50, energySpent } }, command.id);
  }

  const outcomes = ["WIN", "GAME_OVER", "WIN", "GAME_OVER", "GAME_OVER", "WIN", "WIN", "GAME_OVER", "GAME_OVER", "WIN"];
  const energySpends = [20, 999, 40, 999, 999, 60, 80, 999, 999, 100];
  for (let index = 0; index < outcomes.length; index += 1) await finish("Evaluated", outcomes[index], energySpends[index]);
  for (let index = 0; index < outcomes.length; index += 1) await finish("Efficient", outcomes[index], energySpends[index] / 2);
  await finish("Evaluated", "WIN");
  await finish("Pending", "GAME_OVER");
  await finish("Pending", "WIN");
  for (let index = 0; index < 10; index += 1) await finish("AllFailed", "GAME_OVER", 500 + index);

  const entries = store.getLeaderboard("rf01").entries;
  const evaluated = entries.find((entry) => entry.agent === "Evaluated");
  const efficient = entries.find((entry) => entry.agent === "Efficient");
  const pending = entries.find((entry) => entry.agent === "Pending");
  const allFailed = entries.find((entry) => entry.agent === "AllFailed");

  assert.equal(evaluated.successRate1, 1);
  assert.equal(evaluated.successRate5, 0.4);
  assert.equal(evaluated.successRate10, 0.5);
  assert.equal(evaluated.averageEnergySpent1, 20);
  assert.equal(evaluated.averageEnergySpent5, 30);
  assert.equal(evaluated.averageEnergySpent10, 60);
  assert.equal(evaluated.evaluationComplete, true);
  assert.equal(evaluated.evaluationWins, 5);
  assert.equal(evaluated.protocolAttempts, 10);
  assert.equal(evaluated.totalAttempts, 11);
  assert.equal(efficient.averageEnergySpent10, 30);
  assert.equal(efficient.rank, 1);
  assert.equal(evaluated.rank, 2);
  assert.equal(pending.successRate1, 0);
  assert.equal(pending.successRate5, null);
  assert.equal(pending.successRate10, null);
  assert.equal(pending.evaluationComplete, false);
  assert.equal(pending.evaluationWins, 1);
  assert.equal(pending.rank, null);
  assert.equal(pending.protocolAttempts, 2);
  assert.equal(pending.attemptLimit, 10);
  assert.equal(allFailed.evaluationComplete, true);
  assert.equal(allFailed.averageEnergySpent1, null);
  assert.equal(allFailed.averageEnergySpent5, null);
  assert.equal(allFailed.averageEnergySpent10, null);
});

test("episode energy spent remains cumulative when task rewards increase reserve", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "arc-energy-spent-"));
  const store = new AgentPlatformStore({ root });
  context.after(() => store.close());
  const created = store.createEpisode({
    level: "rf01",
    harness: "visual",
    view: "dual",
    engine: "tool",
    agent: { name: "Energy", version: "1" },
    model: "vision-model",
  });
  const browserToken = new URL(created.gameUrl).searchParams.get("browser_token");
  await store.submitObservation(created.episode.id, browserToken, { status: "NOT_FINISHED", harness: "visual", hud: { reserve: 100, energySpent: 0 } });

  async function act(action, reserve, energySpent, status = "NOT_FINISHED") {
    const command = store.enqueueCommand(created.episode.id, created.agentToken, { kind: "act", action });
    store.nextCommand(created.episode.id, browserToken);
    await store.submitObservation(created.episode.id, browserToken, { status, harness: "visual", hud: { reserve, energySpent } }, command.id);
  }

  await act("W", 60, 40);
  await act("F", 90, 45);
  await act("W", 0, 135, "WIN");
  const result = store.getResult(created.episode.id, created.agentToken);
  assert.equal(result.ready, true);
  assert.equal(result.energyRemaining, 0);
  assert.equal(result.energySpent, 135);
});
