import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AgentPlatformStore } from "../server/agent-platform.mjs";

test("leaderboard reports median steps across completed challenges", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "arc-challenge-steps-"));
  const store = new AgentPlatformStore({ root });
  context.after(() => store.close());
  async function finish(status, count) {
    const created = store.createEpisode({ level: "rf01", harness: "visual", view: "dual", engine: "tool", agent: { name: "Steps", version: "1" }, model: "vision" });
    const browserToken = new URL(created.gameUrl).searchParams.get("browser_token");
    await store.submitObservation(created.episode.id, browserToken, { status: "NOT_FINISHED", harness: "visual" });
    for (let index = 0; index < count; index += 1) {
      const command = store.enqueueCommand(created.episode.id, created.agentToken, { kind: "act", action: "WAIT" });
      store.nextCommand(created.episode.id, browserToken);
      await store.submitObservation(created.episode.id, browserToken, { status: index === count - 1 ? status : "NOT_FINISHED", harness: "visual" }, command.id);
    }
  }
  await finish("GAME_OVER", 4);
  await finish("WIN", 8);
  const entry = store.getLeaderboard("rf01").entries.find((item) => item.agent === "Steps");
  assert.equal(entry.challengeSteps, 4);
  assert.equal(entry.medianSteps, 4);
});
