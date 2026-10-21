import assert from "node:assert/strict";
import test from "node:test";
import { ArcAgentClient } from "../tools/arc-agent-client.mjs";

test("generic ARC client keeps agent credentials in authorization headers", async () => {
  const requests = [];
  const client = new ArcAgentClient({
    baseUrl: "http://arc.test",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ id: "episode" }) };
    },
  });
  await client.status("episode", "secret-token");
  assert.equal(requests[0].options.headers.authorization, "Bearer secret-token");
  assert.doesNotMatch(requests[0].url, /secret-token/);
});

test("generic ARC client sends normalized action commands", async () => {
  const requests = [];
  const client = new ArcAgentClient({
    baseUrl: "http://arc.test",
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith("/commands")) return { ok: true, status: 202, json: async () => ({ id: "command-1" }) };
      return { ok: true, status: 200, json: async () => ({ commandId: "command-1", status: "NOT_FINISHED" }) };
    },
  });
  const observation = await client.act("episode", "token", "W", { durationMs: 300, intervalMs: 1 });
  assert.equal(observation.commandId, "command-1");
  assert.deepEqual(JSON.parse(requests[0].options.body), { kind: "act", action: "W", durationMs: 300 });
});
