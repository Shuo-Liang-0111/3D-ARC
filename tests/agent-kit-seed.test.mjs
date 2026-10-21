import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import { createInterface } from "node:readline";
import test from "node:test";
import { fileURLToPath } from "node:url";

// All HTTP responses, credentials and observations below are synthetic loopback fixtures.
// No deployed ARC Episode, browser or model provider is contacted by these tests.
const clients = [
  ["Node.js", process.execPath, "../public/agent-kit/node-agent.mjs"],
  ["Python", "python3", "../public/agent-kit/python-agent.py"],
];
const invalidSeeds = ["", " ", "-1", "4294967296", "1.5", "1e3", "NaN", "Infinity", "42x"];

async function fixture(t) {
  const requests = [];
  const failures = [];
  let url;
  let currentSeed;
  const server = http.createServer(async (request, response) => {
    try {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const body = raw ? JSON.parse(raw) : undefined;
      requests.push({ method: request.method, path: request.url, body });
      let payload;
      if (request.url === "/api/v1/episodes") {
        assert.equal(request.method, "POST");
        currentSeed = body.seed;
        payload = {
          episode: { id: "synthetic-seed", harness: body.harness, seed: currentSeed, seedApplied: currentSeed !== undefined },
          agentToken: "synthetic-agent-token",
          gameUrl: `${url}/synthetic-game?browser_token=synthetic-browser-token`,
        };
      } else if (request.url === "/api/v1/episodes/synthetic-seed/observations/latest") {
        payload = {
          status: "GAME_OVER", commandId: null,
          screenshot: "data:image/png;base64,c3ludGhldGlj",
          actionDescriptions: { WAIT: "Apply no input" },
          seed: currentSeed, seedApplied: true,
        };
      } else if (request.url === "/api/v1/episodes/synthetic-seed/status") {
        payload = { id: "synthetic-seed", harness: "visual", status: "completed", seed: currentSeed, seedApplied: true, seedVerified: true, seedPolicy: "seeded", seedSource: "provided", initialStateFingerprint: "fnv1a64-v1:0123456789abcdef" };
      } else {
        assert.fail(`Unexpected endpoint: ${request.url}; no model call is allowed`);
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload));
    } catch (error) {
      failures.push(error);
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  url = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { server.closeAllConnections(); server.close(); });
  return { url, requests, failures };
}

function launch(t, service, binary, relativeScript, seed) {
  const child = spawn(binary, [fileURLToPath(new URL(relativeScript, import.meta.url))], {
    env: {
      PATH: process.env.PATH,
      ARC_AGENT_API_URL: service.url,
      MODEL_API_URL: `${service.url}/model`,
      MODEL_API_KEY: "synthetic-model-key",
      MODEL_NAME: "synthetic-model",
      ARC_HARNESS: "state",
      NO_PROXY: "127.0.0.1",
      ...(seed === undefined ? {} : { ARC_SEED: seed }),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
  const closed = once(child, "close").then(([code, signal]) => {
    clearTimeout(timer);
    return { code, signal, output };
  });
  t.after(() => { clearTimeout(timer); if (child.exitCode === null) child.kill("SIGKILL"); });
  return { child, closed };
}

for (const [name, binary, script] of clients) {
  test(`${name} ARC_SEED reaches the Episode POST as an integer, including both uint32 boundaries`, { timeout: 30_000 }, async (t) => {
    for (const seed of [undefined, "0", "42", "4294967295"]) {
      const service = await fixture(t);
      const { child, closed } = launch(t, service, binary, script, seed);
      child.stdin.end();
      const result = await closed;
      assert.equal(result.code, 0, result.output);
      assert.deepEqual(service.failures, [], result.output);
      const posts = service.requests.filter((request) => request.method === "POST");
      assert.equal(posts.length, 1, "exactly one synthetic Episode request");
      assert.deepEqual(posts[0].body, {
        level: "rf01", view: "dual", harness: "state",
        ...(seed === undefined ? {} : { seed: Number(seed) }),
      });
    }
  });

  test(`${name} invalid ARC_SEED exits before any Episode or model request`, { timeout: 30_000 }, async (t) => {
    const service = await fixture(t);
    for (const seed of invalidSeeds) {
      const { child, closed } = launch(t, service, binary, script, seed);
      child.stdin.end();
      const result = await closed;
      assert.notEqual(result.code, 0, `Accepted invalid seed ${JSON.stringify(seed)}`);
      assert.match(result.output, /ARC_SEED must be an integer from 0 through 4294967295/);
      assert.equal(service.requests.length, 0, `Invalid seed ${JSON.stringify(seed)} made an HTTP request`);
    }
  });
}

function rpcClient(child) {
  const pending = new Map();
  let sequence = 0;
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    const response = JSON.parse(line);
    if (pending.has(response.id)) {
      pending.get(response.id)(response);
      pending.delete(response.id);
    }
  });
  return (method, params = {}) => new Promise((resolve) => {
    const id = ++sequence;
    pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

const call = (rpc, name, args = {}) => rpc("tools/call", { name, arguments: args });

test("MCP seed overrides ARC_SEED, is status metadata, and is excluded from visual observations", { timeout: 15_000 }, async (t) => {
  const service = await fixture(t);
  const { child, closed } = launch(t, service, process.execPath, "../tools/arc-opencode-mcp.mjs", "42");
  const rpc = rpcClient(child);
  const listing = await rpc("tools/list");
  const schema = listing.result.tools.find((tool) => tool.name === "start_episode").inputSchema;
  assert.deepEqual({ type: schema.properties.seed.type, minimum: schema.properties.seed.minimum, maximum: schema.properties.seed.maximum }, {
    type: "integer", minimum: 0, maximum: 4294967295,
  });
  const started = await call(rpc, "start_episode", { level: "rf01", view: "dual", harness: "visual", managedBrowser: false, seed: 0 });
  assert.equal(started.result.isError, false);
  assert.equal(service.requests[0].body.seed, 0, "explicit zero must override the environment default");
  const status = JSON.parse((await call(rpc, "get_status")).result.content[0].text);
  assert.equal(status.seed, 0);
  assert.equal(status.seedApplied, true);
  assert.equal(status.seedVerified, true);
  assert.equal(status.seedPolicy, "seeded");
  assert.equal(status.seedSource, "provided");
  assert.equal(status.initialStateFingerprint, "fnv1a64-v1:0123456789abcdef");
  const observation = (await call(rpc, "observe")).result.content;
  assert.equal(observation[1].type, "image");
  const visible = JSON.parse(observation[0].text);
  assert.equal("seed" in visible, false);
  assert.equal("seedApplied" in visible, false);
  for (const seed of [-1, 4294967296, 1.5, "42", null, true]) {
    const before = service.requests.length;
    const rejected = await call(rpc, "start_episode", { seed, managedBrowser: false });
    assert.equal(rejected.result.isError, true);
    assert.match(rejected.result.content[0].text, /seed must be an integer/);
    assert.equal(service.requests.length, before, "invalid MCP input must fail before an API request");
  }
  const fallback = await call(rpc, "start_episode", { level: "rf01", harness: "visual", managedBrowser: false });
  assert.equal(fallback.result.isError, false);
  assert.equal(service.requests.at(-1).body.seed, 42);
  child.stdin.end();
  const result = await closed;
  assert.equal(result.code, 0, result.output);
  assert.deepEqual(service.failures, []);
});

test("MCP rejects an invalid ARC_SEED before any Episode request", { timeout: 15_000 }, async (t) => {
  const service = await fixture(t);
  const { child, closed } = launch(t, service, process.execPath, "../tools/arc-opencode-mcp.mjs", "-1");
  child.stdin.end();
  const result = await closed;
  assert.notEqual(result.code, 0);
  assert.match(result.output, /ARC_SEED must be an integer/);
  assert.equal(service.requests.length, 0);
});
