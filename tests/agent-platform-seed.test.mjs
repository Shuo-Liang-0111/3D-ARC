import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AgentPlatformStore, createAgentPlatformRouter } from "../server/agent-platform.mjs";

// Every store, signing key and HTTP server in this file is a disposable local fixture.
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "arc-seed-platform-"));
  let store = new AgentPlatformStore({ root });
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
  return {
    root,
    get store() { return store; },
    reopen() { store.close(); store = new AgentPlatformStore({ root }); return store; },
  };
}

function create(store, options = {}) {
  return store.createEpisode({ level: "rf02-3", harness: "visual", engine: "tool", gameBaseUrl: "http://synthetic.test/", ...options });
}
const browserToken = (created) => new URL(created.gameUrl).searchParams.get("browser_token");
const environment = (seed = 42, changes = {}) => ({
  protocolVersion: "arc-seed-v1", seed, seedPolicy: "seeded", seedApplied: true,
  initialStateFingerprint: "fnv1a64-v1:0123456789abcdef", ...changes,
});
const fixedEnvironment = () => environment(null, { seedPolicy: "fixed", seedApplied: false, initialStateFingerprint: null });
const observation = (env) => ({ status: "NOT_FINISHED", ...(env === undefined ? {} : { environment: env }) });

async function finish(store, created, env) {
  const command = store.enqueueCommand(created.episode.id, created.agentToken, { kind: "act", action: "WAIT", durationMs: 50 });
  store.nextCommand(created.episode.id, browserToken(created));
  await store.submitObservation(created.episode.id, browserToken(created), {
    ...observation(env), status: "GAME_OVER", actionResult: { action: "WAIT" },
  }, command.id);
  return store.getResult(created.episode.id, created.agentToken);
}

test("seed API validates numeric uint32 boundaries and transports only applied-level seeds in gameUrl", async (t) => {
  const { store } = await fixture(t);
  for (const seed of [0, 42, 4294967295]) {
    const created = create(store, { seed, gameBaseUrl: "http://synthetic.test/?mode=play" });
    assert.equal(new URL(created.gameUrl).searchParams.get("mode"), "agent");
    assert.equal(created.episode.seed, seed);
    assert.equal(created.episode.seedSource, "provided");
    assert.equal(created.episode.seedPolicy, "seeded");
    assert.equal(created.episode.seedApplied, false, "creation must not claim browser application");
    assert.equal(created.episode.seedVerified, false);
    assert.equal(created.episode.initialStateFingerprint, null);
    assert.equal(new URL(created.gameUrl).searchParams.get("seed"), String(seed));
  }
  for (const seed of ["42", null, true, -1, 4294967296, 0.5, NaN, Infinity, {}, []]) {
    assert.throws(() => create(store, { seed }), (error) => error.status === 400 && /seed/.test(error.message));
  }
  const generated = create(store);
  assert.ok(Number.isInteger(generated.episode.seed) && generated.episode.seed >= 0 && generated.episode.seed <= 4294967295);
  assert.equal(generated.episode.seedSource, "generated");
  assert.equal(new URL(generated.gameUrl).searchParams.get("seed"), String(generated.episode.seed));
  const fixed = create(store, { level: "rf01", seed: 0, gameBaseUrl: "http://synthetic.test/?seed=999" });
  assert.equal(fixed.episode.seed, 0);
  assert.equal(fixed.episode.seedPolicy, "fixed");
  assert.equal(fixed.episode.seedApplied, false);
  assert.equal(new URL(fixed.gameUrl).searchParams.has("seed"), false, "fixed pages must retain their old URL behavior");
});

test("provided seeds require strict matching browser metadata and reject nested state or changed fingerprints", async (t) => {
  const { store } = await fixture(t);
  const created = create(store, { seed: 0 });
  const submit = (env) => store.submitObservation(created.episode.id, browserToken(created), observation(env));
  for (const env of [
    undefined, null, [], {},
    environment(42), environment("0"), environment(0, { protocolVersion: "other" }),
    environment(0, { seedPolicy: "fixed" }), environment(0, { seedApplied: false }),
    environment(0, { seedApplied: 1 }), environment(0, { initialStateFingerprint: null }),
    environment(0, { initialStateFingerprint: "wrong" }),
    environment(0, { state: { player: { x: 10 } } }),
    environment(0, { initialStateFingerprint: { hidden: "state" } }),
  ]) await assert.rejects(submit(env), (error) => error.status === 400);
  await submit(environment(0));
  const status = store.getStatus(created.episode.id, created.agentToken);
  assert.equal(status.seed, 0);
  assert.equal(status.seedApplied, true);
  assert.equal(status.seedVerified, true);
  assert.equal(status.initialStateFingerprint, environment(0).initialStateFingerprint);
  await submit(environment(0));
  await assert.rejects(submit(undefined), /缺少 environment/);
  await assert.rejects(submit(environment(0, { initialStateFingerprint: "fnv1a64-v1:1111111111111111" })), /不能改变/);
  assert.deepEqual((await store.getLatestObservation(created.episode.id, created.agentToken)).environment, environment(0));
});

test("first validated environment cannot race with another fingerprint", async (t) => {
  const { store } = await fixture(t);
  const created = create(store, { seed: 42 });
  const results = await Promise.allSettled([
    store.submitObservation(created.episode.id, browserToken(created), observation(environment(42))),
    store.submitObservation(created.episode.id, browserToken(created), observation(environment(42, { initialStateFingerprint: "fnv1a64-v1:1111111111111111" }))),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
});

test("generated and fixed legacy clients remain unverified; fixed metadata confirms policy without applying a seed", async (t) => {
  const { store } = await fixture(t);
  for (const options of [{}, { level: "rf01" }, { level: "rf01", seed: 42 }]) {
    const created = create(store, options);
    await store.submitObservation(created.episode.id, browserToken(created), observation());
    const status = store.getStatus(created.episode.id, created.agentToken);
    assert.equal(status.seedApplied, false);
    assert.equal(status.seedVerified, false);
    const result = await finish(store, created);
    assert.equal(result.seed, created.episode.seed);
    assert.equal(result.seedApplied, false);
    assert.equal(result.seedVerified, false);
  }
  const fixed = create(store, { level: "rf01", seed: 42 });
  await assert.rejects(store.submitObservation(fixed.episode.id, browserToken(fixed), observation(environment(42))), /不一致/);
  await store.submitObservation(fixed.episode.id, browserToken(fixed), observation(fixedEnvironment()));
  const fixedStatus = store.getStatus(fixed.episode.id, fixed.agentToken);
  assert.equal(fixedStatus.seed, 42);
  assert.equal(fixedStatus.seedVerified, true);
  assert.equal(fixedStatus.seedApplied, false);
  assert.equal(fixedStatus.initialStateFingerprint, null);
});

test("a generated legacy Episode cannot upgrade verification after its first observation", async (t) => {
  const { store } = await fixture(t);
  const created = create(store);
  const id = created.episode.id;
  const token = browserToken(created);
  await store.submitObservation(id, token, observation());
  await assert.rejects(store.submitObservation(id, token, observation(environment(created.episode.seed))), /首张观察/);
  const first = store.enqueueCommand(id, created.agentToken, { kind: "act", action: "WAIT", durationMs: 50 });
  store.nextCommand(id, token);
  await store.submitObservation(id, token, { ...observation(), actionResult: { action: "WAIT" } }, first.id);
  const final = store.enqueueCommand(id, created.agentToken, { kind: "act", action: "WAIT", durationMs: 50 });
  store.nextCommand(id, token);
  await assert.rejects(store.submitObservation(id, token, {
    ...observation(environment(created.episode.seed)), status: "GAME_OVER", actionResult: { action: "WAIT" },
  }, final.id), /首张观察/);
  assert.equal(store.getStatus(id, created.agentToken).seedVerified, false);
  await store.submitObservation(id, token, { ...observation(), status: "GAME_OVER", actionResult: { action: "WAIT" } }, final.id);
  const result = store.getResult(id, created.agentToken);
  assert.equal(result.ready, true);
  assert.equal(result.seedVerified, false);
  assert.equal(result.seedApplied, false);
  assert.equal(store.getLeaderboard("rf02-3").entries[0].seedVerified, false);
});

test("seed metadata persists across restart and is bound into result and signed trajectory", async (t) => {
  const fixture_ = await fixture(t);
  const created = create(fixture_.store, { seed: 4294967295 });
  await fixture_.store.submitObservation(created.episode.id, browserToken(created), {
    ...observation(environment(4294967295)), seedConfiguration: { seed: "forged" },
  });
  fixture_.reopen();
  const status = fixture_.store.getStatus(created.episode.id, created.agentToken);
  assert.equal(status.seed, 4294967295);
  assert.equal(status.seedVerified, true);
  const result = await finish(fixture_.store, created, environment(4294967295));
  assert.equal(result.ready, true);
  for (const key of ["seed", "seedSource", "seedPolicy", "seedApplied", "seedVerified", "initialStateFingerprint"]) {
    assert.equal(result[key], status[key]);
  }
  const lines = (await readFile(join(fixture_.root, "episodes", created.episode.id, "trajectory.jsonl"), "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(lines.length, 2);
  let previous = null;
  for (const entry of lines) {
    assert.equal(entry.seed, 4294967295);
    assert.equal(entry.seedVerified, true);
    assert.equal(entry.observation.seedConfiguration.seed, 4294967295);
    const hash = createHash("sha256").update(JSON.stringify({
      episodeId: created.episode.id, commandId: entry.commandId, step: entry.step,
      metadata: entry.observation, framePath: entry.framePath, prevHash: previous,
    })).digest("hex");
    assert.equal(hash, entry.integrity.recordHash);
    assert.equal(createHmac("sha256", fixture_.store.signingKey).update(hash).digest("hex"), entry.integrity.serverSignature);
    previous = hash;
  }
  assert.equal(result.integrity.chainHead, previous);
  fixture_.reopen();
  assert.deepEqual(fixture_.store.getResult(created.episode.id, created.agentToken), result);
});

test("legacy database migration leaves old rows without inferred seeds", async (t) => {
  const fixture_ = await fixture(t);
  const created = create(fixture_.store, { level: "rf01" });
  const legacyRandom = create(fixture_.store);
  fixture_.store.db.exec("ALTER TABLE episodes DROP COLUMN environment_seed; ALTER TABLE episodes DROP COLUMN seed_source; ALTER TABLE episodes DROP COLUMN environment_json;");
  fixture_.reopen();
  const status = fixture_.store.getStatus(created.episode.id, created.agentToken);
  assert.equal(status.seed, null);
  assert.equal(status.seedSource, null);
  assert.equal(status.seedVerified, false);
  await fixture_.store.submitObservation(created.episode.id, browserToken(created), observation());
  await fixture_.store.submitObservation(legacyRandom.episode.id, browserToken(legacyRandom), observation(environment(null, { seedApplied: false, initialStateFingerprint: null })));
  const legacyStatus = fixture_.store.getStatus(legacyRandom.episode.id, legacyRandom.agentToken);
  assert.equal(legacyStatus.seed, null);
  assert.equal(legacyStatus.seedVerified, true);
  assert.equal(legacyStatus.seedApplied, false);
});

test("leaderboard preserves its identity grouping and explicitly exposes mixed seed windows", async (t) => {
  const { store } = await fixture(t);
  for (const seed of [0, 42]) {
    const created = create(store, { seed, agent: { name: "same-agent", version: "same-batch" } });
    await store.submitObservation(created.episode.id, browserToken(created), observation(environment(seed)));
    await finish(store, created, environment(seed));
  }
  const board = store.getLeaderboard("rf02-3");
  assert.equal(board.entries.length, 1, "seed must not silently alter the established ten-run grouping");
  assert.equal(board.entries[0].protocolAttempts, 2);
  assert.equal(board.entries[0].seed, null);
  assert.deepEqual(board.entries[0].seeds.sort((a, b) => a - b), [0, 42]);
  assert.equal(board.entries[0].seedApplied, true);
  assert.equal(board.entries[0].seedVerified, true);
});

test("HTTP capabilities are public without creating an Episode, and JSON string seeds are rejected", async (t) => {
  const { store } = await fixture(t);
  const router = createAgentPlatformRouter({ store, gameBaseUrl: "http://synthetic.test/", readBody: async (req) => {
    let text = ""; for await (const chunk of req) text += chunk; return JSON.parse(text);
  } });
  const server = http.createServer(async (req, res) => {
    if (!await router(req, res, new URL(req.url, "http://127.0.0.1"))) { res.writeHead(404); res.end(); }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(`${base}/api/v1/seed-capabilities`);
  assert.equal(response.status, 200);
  const capabilities = await response.json();
  assert.equal(capabilities.protocolVersion, "arc-seed-v1");
  assert.equal(capabilities.minSeed, 0);
  assert.equal(capabilities.maxSeed, 4294967295);
  assert.equal(capabilities.levels.find((level) => level.id === "rf02-3").seedPolicy, "seeded");
  assert.equal(capabilities.levels.find((level) => level.id === "rf01").seedPolicy, "fixed");
  assert.equal(store.db.prepare("SELECT COUNT(*) AS count FROM episodes").get().count, 0);
  for (const seed of ["0", null, 4294967296]) {
    const rejected = await fetch(`${base}/api/v1/episodes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ level: "rf02-3", seed }) });
    assert.equal(rejected.status, 400);
  }
  const accepted = await fetch(`${base}/api/v1/episodes`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ level: "rf02-3", seed: 0 }) });
  assert.equal(accepted.status, 201);
  assert.equal((await accepted.json()).episode.seed, 0);
});
