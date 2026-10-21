import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";

// Synthetic loopback services only: these tests never connect to ARC or a model provider.
const completion = (content) => ({ choices: [{ message: { content } }] });
const invalidResponses = [
  "not a JSON response envelope",
  completion("not JSON"),
  completion('{"action":'),
  completion(JSON.stringify({ action: "W", memory: { mustNotPersist: true } })),
  ...[49, 1001, "300", true, null].map((durationMs) => completion(JSON.stringify({
    action: "W", durationMs, memory: { mustNotPersist: true },
  }))),
  completion('{"action":"W","durationMs":1e999}'),
  completion(`{"action":"W","durationMs":${"9".repeat(400)}}`),
  ...["FLY", ["W"], null].map((action) => completion(JSON.stringify({ action, durationMs: 500 }))),
  completion('prefix {"action":"W","durationMs":500}'),
  completion('["W",500]'),
  { choices: [] },
];
const actions = ["W", "A", "S", "D", "E", "WAIT", "TURN_LEFT", "TURN_RIGHT"];
const actionDescriptions = Object.fromEntries(actions.map((action) => [action, `Published meaning for ${action}`]));
const privateState = { hud: { private: "HUD_SENTINEL" }, state: "STATE_SENTINEL", event: "EVENT_SENTINEL" };
const clients = [
  ["Node.js", process.execPath, "../public/agent-kit/node-agent.mjs"],
  ["Python", "python3", "../public/agent-kit/python-agent.py"],
];

async function runStarter(t, client, { terminalStatus, actionCount, invalid = [], harness = "hybrid", lostCommand = null, noScreenshot = false, managedMode = "override" }) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "arc-starter-browser-mock-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const marker = join(fixtureRoot, "browser.json");
  const closedMarker = join(fixtureRoot, "closed");
  const browserScript = join(fixtureRoot, "arc-managed-browser.mjs");
  await writeFile(browserScript, `
    import { writeFileSync } from "node:fs";
    import { createInterface } from "node:readline";
    const lines = createInterface({ input: process.stdin });
    lines.once("line", (url) => {
      writeFileSync(process.env.ARC_TEST_BROWSER_MARKER, JSON.stringify({
        args: process.argv.slice(2), url,
        credentialNames: Object.keys(process.env).filter((name) => /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|^(MODEL|OPENAI|GEILI|ANTHROPIC|AZURE_OPENAI)_/i.test(name)),
      }));
      if (process.env.ARC_TEST_BROWSER_MODE === "failure") {
        console.error("synthetic-private-token synthetic-model-key");
        console.log(JSON.stringify({ ready: false, error: "managed_browser_startup_failed" }));
        process.exit(1);
      }
      console.log(JSON.stringify({ ready: true }));
    });
    process.stdin.on("end", () => { writeFileSync(process.env.ARC_TEST_BROWSER_CLOSED, "closed"); process.exit(0); });
  `);
  const originalScript = fileURLToPath(new URL(client[2], import.meta.url));
  const starterScript = managedMode === "sibling" ? join(fixtureRoot, originalScript.split("/").at(-1)) : originalScript;
  if (managedMode === "sibling") await writeFile(starterScript, await readFile(originalScript));
  const commands = [];
  const patches = [];
  const modelRequests = [];
  const failures = [];
  const memory = { plan: "synthetic test plan", serverEvents: "MEMORY_EVENT_SENTINEL" };
  const screenshot = noScreenshot ? undefined : "data:image/png;base64,c3ludGhldGlj";
  let memoryReads = 0;
  let observations = 0;
  let statusReads = 0;
  let commandPosts = 0;
  let recovering = false;
  let serviceUrl;
  let child;
  const server = http.createServer(async (request, response) => {
    try {
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const body = raw ? JSON.parse(raw) : undefined;
      let result;
      if (request.url === "/model") {
        assert.equal(request.headers.authorization, "Bearer synthetic-model-key");
        assert.equal(body.model, "synthetic-model");
        assert.match(body.messages[0].content, /durationMs/);
        const content = body.messages[1].content;
        assert.equal(content[1].image_url.url, screenshot);
        assert.equal(content.length, 2, "one current image and one concise text context");
        assert.match(body.messages[0].content, /A strafes left; D strafes right/);
        assert.match(body.messages[0].content, /E interacts/);
        assert.match(body.messages[0].content, /TURN_LEFT and TURN_RIGHT rotate heading/);
        assert.deepEqual(JSON.parse(content[0].text), {
          observation: harness === "visual" ? { actionDescriptions } : {
            status: "NOT_FINISHED",
            commandId: commands.length ? `command-${commands.length}` : null,
            actionDescriptions,
            ...privateState,
          },
          memory: harness === "visual" ? (commands.length ? { step: commands.length } : {}) : memory,
        });
        if (harness === "visual") assert.doesNotMatch(JSON.stringify(body.messages), /SENTINEL/);
        modelRequests.push(body);
        if (modelRequests.length <= invalid.length) {
          assert.equal(commands.length, 0, "invalid decisions cannot submit commands");
          assert.equal(patches.length, 0, "invalid decisions cannot patch memory");
          result = invalid[modelRequests.length - 1];
        } else {
          const action = actions[commands.length % actions.length];
          const durationMs = [50, 1000, 775.5][commands.length % 3];
          const text = JSON.stringify({ action, durationMs, memory: { step: commands.length + 1 } });
          result = completion(commands.length % 2 ? text : [{ type: "text", text }]);
        }
      } else {
        assert.notEqual(request.headers.authorization, "Bearer synthetic-model-key");
        assert.doesNotMatch(raw, /synthetic-model-key/);
        if (request.url === "/api/v1/episodes") {
          assert.equal(request.method, "POST");
          result = { episode: { id: "synthetic" }, agentToken: "synthetic-agent-token", gameUrl: `${serviceUrl}/synthetic-game?browser_token=synthetic-private-token` };
        } else {
          assert.equal(request.headers.authorization, "Bearer synthetic-agent-token");
          if (harness !== "state") assert.equal(existsSync(marker), true, "wait for managed-browser readiness before observing");
          if (request.url.endsWith("/status")) {
            statusReads += 1;
            result = { activeCommand: lostCommand === "active" ? { id: `command-${commands.length}` } : null };
          } else if (request.url.endsWith("/observations/latest")) {
            observations += 1;
            if (managedMode === "signal") {
              child.kill("SIGTERM");
              return;
            }
            const acknowledged = recovering && lostCommand === "active" ? commands.length - 1 : commands.length;
            recovering = false;
            result = {
              status: acknowledged >= actionCount ? terminalStatus : "NOT_FINISHED",
              commandId: acknowledged ? `command-${acknowledged}` : null,
              screenshot,
              actionDescriptions,
              ...privateState,
            };
          } else if (request.url.endsWith("/memory")) {
            if (request.method === "PATCH") {
              assert.ok(modelRequests.length > invalid.length);
              assert.deepEqual(body, { step: commands.length + 1 });
              patches.push(body);
            } else {
              memoryReads += 1;
            }
            result = memory;
          } else if (request.url.endsWith("/commands")) {
            assert.ok(modelRequests.length > invalid.length);
            assert.deepEqual(body, {
              kind: "act",
              action: actions[commands.length % actions.length],
              durationMs: [50, 1000, 775.5][commands.length % 3],
            });
            commandPosts += 1;
            if (lostCommand !== "unknown") commands.push(body);
            if (lostCommand && commandPosts === 1) {
              recovering = true;
              response.destroy();
              return;
            }
            result = { id: `command-${commands.length}` };
          } else {
            assert.fail(`Unexpected endpoint: ${request.url}`);
          }
        }
      }
      response.writeHead(200, { "content-type": "application/json" });
      response.end(typeof result === "string" ? result : JSON.stringify(result));
    } catch (error) {
      failures.push(error);
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: error.message }));
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  serviceUrl = `http://127.0.0.1:${server.address().port}`;
  t.after(() => { server.closeAllConnections(); server.close(); });
  child = spawn(client[1], [starterScript], {
    env: {
      PATH: process.env.PATH,
      ARC_AGENT_API_URL: serviceUrl,
      MODEL_API_URL: `${serviceUrl}/model`,
      MODEL_API_KEY: "synthetic-model-key",
      MODEL_NAME: "synthetic-model",
      ARC_HARNESS: harness,
      NODE_BINARY: process.execPath,
      ...(managedMode === "sibling" ? {} : { ARC_MANAGED_BROWSER_SCRIPT: managedMode === "missing" ? join(fixtureRoot, "missing.mjs") : browserScript }),
      ARC_TEST_BROWSER_MARKER: marker,
      ARC_TEST_BROWSER_CLOSED: closedMarker,
      ARC_TEST_BROWSER_MODE: managedMode,
      GEILI_API_KEY: "synthetic-other-key",
      OPENAI_API_KEY: "synthetic-other-key",
      ARC_MODEL_API_KEY: "synthetic-other-key",
      CUSTOM_ACCESS_TOKEN: "synthetic-private-token",
      APP_SECRET: "synthetic-other-secret",
      MAX_STEPS: "1", // Legacy configuration must not cap the new loop.
      NO_PROXY: "127.0.0.1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 10_000);
  t.after(() => clearTimeout(timeout));
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const [code, signal] = await once(child, "close");
  assert.deepEqual(failures, [], output);
  if (harness === "state") {
    assert.equal(existsSync(marker), false, "state mode retains manual browser startup");
    assert.match(output, /Open this game URL in a browser/);
  } else if (managedMode === "missing") {
    assert.equal(existsSync(marker), false);
  } else {
    const browser = JSON.parse(await readFile(marker, "utf8"));
    assert.deepEqual(browser.args, ["--game-url-stdin"], "private game URL must not enter argv");
    assert.equal(browser.url, `${serviceUrl}/synthetic-game?browser_token=synthetic-private-token`);
    assert.deepEqual(browser.credentialNames, [], "browser process must not inherit model or other credentials");
    if (managedMode !== "failure") assert.equal(await readFile(closedMarker, "utf8"), "closed", "normal and exceptional exits must close browser stdin");
    assert.doesNotMatch(output, /synthetic-private-token|synthetic-model-key|synthetic-other-key|synthetic-other-secret/);
  }
  if (managedMode === "signal") {
    assert.equal(code, 143);
    assert.equal(modelRequests.length, 0);
    assert.equal(commandPosts, 0);
    return;
  }
  if (["failure", "missing"].includes(managedMode)) {
    assert.notEqual(code, 0);
    assert.match(output, /Managed browser infrastructure failed/);
    assert.equal(observations, 0);
    assert.equal(modelRequests.length, 0);
    assert.equal(commandPosts, 0);
    return;
  }
  if (noScreenshot) {
    assert.notEqual(code, 0);
    assert.match(output, /Visual harness requires a screenshot/);
    assert.equal(modelRequests.length, 0);
    assert.equal(commandPosts, 0);
    assert.equal(patches.length, 0);
    return;
  }
  if (lostCommand === "unknown") {
    assert.notEqual(code, 0);
    assert.match(output, /Action delivery is uncertain/);
    assert.equal(commandPosts, 1, "uncertain POST must not be replayed");
    assert.equal(statusReads, 1);
    assert.equal(observations, 2);
    return;
  }
  assert.equal(code, 0, `Client exited with ${signal}: ${output}`);
  assert.equal(commands.length, actionCount);
  assert.equal(commandPosts, actionCount, "POST must not be replayed after a lost response");
  assert.equal(statusReads, lostCommand ? 1 : 0);
  assert.equal(patches.length, actionCount);
  assert.equal(memoryReads, harness === "visual" ? 0 : actionCount, "retry the same memory without reading another observation");
  assert.equal(observations, actionCount + 1 + (lostCommand === "active" ? 1 : 0));
  assert.equal(modelRequests.length, actionCount + invalid.length);
  assert.match(output, new RegExp(`Episode finished: ${terminalStatus} after ${actionCount} actions`));
  assert.doesNotMatch(output, /Stopped after|MAX_STEPS=|synthetic-model-key|SENTINEL|data:image/);
  assert.equal((output.match(/TIMING model_request elapsedMs=\d+ attempt=1 outcome=ok/g) || []).length, modelRequests.length);
  assert.equal((output.match(/TIMING action_ack elapsedMs=\d+ action=\w+ durationMs=[\d.]+ outcome=(ok|recovered)/g) || []).length, actionCount);
  assert.equal((output.match(/TIMING step elapsedMs=\d+ step=\d+ outcome=ok/g) || []).length, actionCount);
  if (invalid.length) {
    for (const request of modelRequests.slice(1, invalid.length + 1)) {
      assert.deepEqual(request.messages.slice(0, 2), modelRequests[0].messages);
      assert.match(request.messages[2].content, /previous response was invalid/);
    }
  }
}

for (const client of clients) {
  for (const managedMode of ["sibling", "failure", "missing", "signal"]) {
    test(`${client[0]} managed-browser startup handles ${managedMode} without credential leakage`, { timeout: 15_000 }, async (t) => {
      await runStarter(t, client, { terminalStatus: "WIN", actionCount: 0, managedMode });
    });
  }
  test(`${client[0]} state mode retains manual browser startup`, { timeout: 15_000 }, async (t) => {
    await runStarter(t, client, { terminalStatus: "GAME_OVER", actionCount: 0, harness: "state" });
  });
  test(`${client[0]} visual mode excludes structured state and server-written memory`, { timeout: 15_000 }, async (t) => {
    await runStarter(t, client, { terminalStatus: "WIN", actionCount: 8, harness: "visual", invalid: invalidResponses });
  });
  test(`${client[0]} requires an image before visual inference`, { timeout: 15_000 }, async (t) => {
    await runStarter(t, client, { terminalStatus: "WIN", actionCount: 1, harness: "visual", noScreenshot: true });
  });
  for (const lostCommand of ["completed", "active", "unknown"]) {
    test(`${client[0]} reconciles a lost action POST response (${lostCommand}) without replay`, { timeout: 15_000 }, async (t) => {
      await runStarter(t, client, { terminalStatus: "WIN", actionCount: 1, lostCommand });
    });
  }
  for (const terminalStatus of ["WIN", "GAME_OVER"]) {
    test(`${client[0]} retries invalid decisions, preserves chosen durations, and reaches ${terminalStatus} beyond 80 actions`, { timeout: 15_000 }, async (t) => {
      await runStarter(t, client, { terminalStatus, actionCount: 81, invalid: invalidResponses });
    });
  }
  test(`${client[0]} makes no model call when the initial observation is terminal`, { timeout: 15_000 }, async (t) => {
    await runStarter(t, client, { terminalStatus: "GAME_OVER", actionCount: 0 });
  });
}


test("Node.js retries only reads and model inference with bounded backoff", async () => {
  const source = readFileSync(new URL("../public/agent-kit/node-agent.mjs", import.meta.url), "utf8").replace(/^import .*;$/gm, "").replaceAll("import.meta.url", '"file:///synthetic/node-agent.mjs"');
  const delays = [];
  const logs = [];
  let attempts = 0;
  let failureStatus = 503;
  let succeedAt = 6;
  const context = vm.createContext({
    process: { env: { ARC_AGENT_API_URL: "http://synthetic", MODEL_API_URL: "http://synthetic/model", MODEL_API_KEY: "synthetic-key", MODEL_NAME: "synthetic-model" } },
    performance,
    AbortSignal: { timeout: () => undefined },
    console: { log: (line) => logs.push(line), warn: () => {} },
    setTimeout: (resolve, milliseconds) => { delays.push(milliseconds); resolve(); },
    fetch: async () => {
      attempts += 1;
      return { ok: attempts === succeedAt, status: attempts === succeedAt ? 200 : failureStatus, json: async () => ({}) };
    },
  });
  vm.runInContext(source.split("const created = await")[0] + "\nglobalThis.request = requestJson;", context);
  await context.request("http://synthetic");
  assert.equal(attempts, 6);
  assert.deepEqual(delays, [2000, 5000, 10000, 20000, 30000]);
  attempts = 0; delays.length = 0; succeedAt = Infinity; failureStatus = 429;
  await assert.rejects(context.request("http://synthetic/model", { method: "POST", modelRequest: true }), { status: 429 });
  assert.equal(attempts, 6);
  assert.deepEqual(delays, [2000, 5000, 10000, 20000, 30000]);
  assert.equal(logs.filter((line) => line.startsWith("TIMING model_request ")).length, 6);
  attempts = 0; delays.length = 0; failureStatus = 503;
  await assert.rejects(context.request("http://synthetic/commands", { method: "POST" }), { status: 503 });
  assert.equal(attempts, 1);
  assert.deepEqual(delays, []);
  attempts = 0; failureStatus = 401;
  await assert.rejects(context.request("http://synthetic"), { status: 401 });
  assert.equal(attempts, 1);
  assert.deepEqual(delays, []);
  attempts = 0;
  context.fetch = async () => ({
    ok: true, status: 200,
    json: async () => {
      attempts += 1;
      if (attempts < 6) throw new TypeError("synthetic response-body disconnect");
      return {};
    },
  });
  await context.request("http://synthetic");
  assert.equal(attempts, 6);
  assert.deepEqual(delays, [2000, 5000, 10000, 20000, 30000]);
});

test("Python retries only reads and model inference with bounded backoff", () => {
  const source = String.raw`
import io
import runpy
import sys
import urllib.error
context = runpy.run_path(sys.argv[1], run_name="offline_test")
request = context["request_json"]
state = {"attempts": 0, "succeed_at": 6, "status": 503}
delays = []
class Response:
    status = 200
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self): return b"{}"
def fake_urlopen(*args, **kwargs):
    state["attempts"] += 1
    if state["attempts"] == state["succeed_at"]: return Response()
    raise urllib.error.HTTPError("http://synthetic", state["status"], "synthetic failure", {}, io.BytesIO(b"{}"))
request.__globals__["urllib"].request.urlopen = fake_urlopen
request.__globals__["time"].sleep = delays.append
request("http://synthetic")
assert state["attempts"] == 6
assert delays == [2, 5, 10, 20, 30]
state.update(attempts=0, succeed_at=-1, status=429)
delays.clear()
try:
    request("http://synthetic/model", method="POST", model_request=True)
    raise AssertionError("retry exhaustion must fail")
except context["RequestError"] as error:
    assert error.status == 429
assert state["attempts"] == 6
assert delays == [2, 5, 10, 20, 30]
state.update(attempts=0, status=503)
delays.clear()
try:
    request("http://synthetic/commands", method="POST")
    raise AssertionError("mutation must fail without retry")
except context["RequestError"] as error:
    assert error.status == 503
assert state["attempts"] == 1 and delays == []
state.update(attempts=0, status=401)
try:
    request("http://synthetic")
    raise AssertionError("authorization failure must not retry")
except context["RequestError"] as error:
    assert error.status == 401
assert state["attempts"] == 1 and delays == []
`;
  const result = spawnSync("python3", ["-c", source, fileURLToPath(new URL("../public/agent-kit/python-agent.py", import.meta.url))], {
    env: { PATH: process.env.PATH, ARC_AGENT_API_URL: "http://synthetic", MODEL_API_URL: "http://synthetic/model", MODEL_API_KEY: "synthetic-key", MODEL_NAME: "synthetic-model" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal((result.stdout.match(/TIMING model_request /g) || []).length, 6);
});


test("Node.js reconciles expired command windows without another POST or model request", async () => {
  const source = readFileSync(new URL("../public/agent-kit/node-agent.mjs", import.meta.url), "utf8").replace(/^import .*;$/gm, "").replaceAll("import.meta.url", '"file:///synthetic/node-agent.mjs"').split("const created = await")[0];
  for (const scenario of ["ack", "WIN", "GAME_OVER", "active", "disconnected", "unknown", "other"]) {
    const logs = [];
    const requests = [];
    let now = 0;
    let statusReads = 0;
    const context = vm.createContext({
      process: { env: { ARC_AGENT_API_URL: "http://synthetic", MODEL_API_URL: "http://synthetic/model", MODEL_API_KEY: "synthetic-key", MODEL_NAME: "synthetic-model" } },
      performance: { now: () => now },
      console: { log: (line) => logs.push(line), warn: (line) => logs.push(line) },
      setTimeout: (resolve) => { now += 91_000; resolve(); },
    });
    const fakeRequest = async (episodeId, token, resource, options = {}) => {
      requests.push({ resource, method: options.method || "GET" });
      if (resource === "commands") return { id: "command-1" };
      if (resource === "status") {
        statusReads += 1;
        return {
          activeCommand: ["active", "disconnected"].includes(scenario) ? { id: "command-1" } : scenario === "other" ? { id: "command-other" } : null,
          status: scenario === "disconnected" ? "waiting_for_browser" : "running",
          lastSeenAt: scenario === "disconnected" ? null : new Date(Date.now() - (scenario === "active" ? 120_000 : 0)).toISOString(),
          memory: { hidden: "DO_NOT_LOG_OR_FORWARD" },
        };
      }
      assert.equal(resource, "observations/latest");
      if (scenario === "disconnected" && statusReads < 2) throw Object.assign(new Error("HTTP 409"), { status: 409 });
      if (statusReads >= (["active", "disconnected"].includes(scenario) ? 2 : 1)) {
        if (["WIN", "GAME_OVER"].includes(scenario)) return { status: scenario, commandId: null };
        if (!["unknown", "other"].includes(scenario)) return { status: "NOT_FINISHED", commandId: "command-1" };
      }
      return { status: "NOT_FINISHED", commandId: "previous" };
    };
    context.fakeRequest = fakeRequest;
    vm.runInContext(source + "\nepisodeRequest = fakeRequest; globalThis.run = actAndObserve;", context);
    const result = context.run("episode-timeout", "synthetic-token", { action: "W", durationMs: 300 }, { commandId: "previous" });
    if (["unknown", "other"].includes(scenario)) {
      await assert.rejects(result, /Episode episode-timeout: command command-1 delivery is uncertain.*No action was resent/);
    } else {
      const observation = await result;
      assert.ok(observation.commandId === "command-1" || ["WIN", "GAME_OVER"].includes(observation.status));
    }
    assert.equal(requests.filter((request) => request.method === "POST").length, 1);
    assert.equal(statusReads, ["active", "disconnected"].includes(scenario) ? 2 : 1);
    assert.match(logs.join("\n"), /wait window 1 expired/);
    assert.doesNotMatch(logs.join("\n"), /DO_NOT_LOG_OR_FORWARD|synthetic-token|model slow/);
    if (scenario === "active") assert.match(logs.join("\n"), /Browser heartbeat is stale.*continuing another 90s window/);
    if (scenario === "disconnected") assert.match(logs.join("\n"), /Browser has not connected.*continuing another 90s window/);
  }
});

test("Python reconciles expired command windows without another POST or model request", () => {
  const source = String.raw`
import runpy
import sys
from datetime import datetime, timezone
context = runpy.run_path(sys.argv[1], run_name="offline_test")
run = context["act_and_observe"]
globals_ = run.__globals__
for scenario in ["ack", "WIN", "GAME_OVER", "active", "disconnected", "unknown", "other"]:
    requests = []
    logs = []
    state = {"now": 0, "status_reads": 0}
    def fake_sleep(_): state["now"] += 91
    globals_["time"].sleep = fake_sleep
    globals_["time"].monotonic = lambda: state["now"]
    globals_["time"].perf_counter = lambda: state["now"]
    globals_["print"] = lambda *args, **kwargs: logs.append(" ".join(str(arg) for arg in args))
    def fake_request(episode_id, token, resource, method="GET", body=None):
        requests.append((resource, method))
        if resource == "commands": return {"id": "command-1"}
        if resource == "status":
            state["status_reads"] += 1
            import time
            last_seen = datetime.fromtimestamp(time.time() - (120 if scenario == "active" else 0), timezone.utc).isoformat()
            return {
                "activeCommand": {"id": "command-1"} if scenario in {"active", "disconnected"} else {"id": "command-other"} if scenario == "other" else None,
                "status": "waiting_for_browser" if scenario == "disconnected" else "running",
                "lastSeenAt": None if scenario == "disconnected" else last_seen,
                "memory": {"hidden": "DO_NOT_LOG_OR_FORWARD"},
            }
        assert resource == "observations/latest"
        if scenario == "disconnected" and state["status_reads"] < 2:
            raise context["RequestError"]("HTTP 409", 409)
        if state["status_reads"] >= (2 if scenario in {"active", "disconnected"} else 1):
            if scenario in {"WIN", "GAME_OVER"}: return {"status": scenario, "commandId": None}
            if scenario not in {"unknown", "other"}: return {"status": "NOT_FINISHED", "commandId": "command-1"}
        return {"status": "NOT_FINISHED", "commandId": "previous"}
    globals_["episode_request"] = fake_request
    try:
        result = run("episode-timeout", "synthetic-token", "W", 300, {"commandId": "previous"})
        assert scenario not in {"unknown", "other"}
        assert result.get("commandId") == "command-1" or result.get("status") in {"WIN", "GAME_OVER"}
    except RuntimeError as error:
        assert scenario in {"unknown", "other"}
        assert "Episode episode-timeout: command command-1 delivery is uncertain" in str(error)
        assert "No action was resent" in str(error)
    assert sum(method == "POST" for _, method in requests) == 1
    assert state["status_reads"] == (2 if scenario in {"active", "disconnected"} else 1)
    output = "\n".join(logs)
    assert "wait window 1 expired" in output
    assert "DO_NOT_LOG_OR_FORWARD" not in output and "synthetic-token" not in output and "model slow" not in output
    if scenario == "active": assert "Browser heartbeat is stale" in output and "continuing another 90s window" in output
    if scenario == "disconnected": assert "Browser has not connected" in output and "continuing another 90s window" in output
`;
  const result = spawnSync("python3", ["-c", source, fileURLToPath(new URL("../public/agent-kit/python-agent.py", import.meta.url))], {
    env: { PATH: process.env.PATH, ARC_AGENT_API_URL: "http://synthetic", MODEL_API_URL: "http://synthetic/model", MODEL_API_KEY: "synthetic-key", MODEL_NAME: "synthetic-model" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
});
