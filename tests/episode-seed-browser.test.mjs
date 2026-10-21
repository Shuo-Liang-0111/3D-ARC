import assert from "node:assert/strict";
import { createServer, request as proxyRequest } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { AgentPlatformStore, createAgentPlatformRouter } from "../server/agent-platform.mjs";
import { ManagedEpisodeBrowser } from "../tools/arc-managed-browser.mjs";
import { SEEDED_LEVEL_IDS } from "../game/environment-seed.js";

// Opt-in: uses a running Vite source server and a real managed Chromium.
// Episodes, observations, and screenshots are confined to disposable test stores.
const enabled = process.env.ARC_SEED_BROWSER_TEST === "1";
const sourceOrigin = process.env.ARC_SEED_TEST_GAME_URL || "http://127.0.0.1:4173";
const fingerprints = new Map();
const cases = [
  ...SEEDED_LEVEL_IDS.map((level) => ({ level, seed: 42 })),
  { level: "rf05-3", seed: 42, compare: "same" },
  { level: "rf05-3", seed: 0, compare: "different" },
  { level: "rf01", seed: 0, fixed: true },
];

for (const scenario of cases) {
  test(`seed browser pipeline ${scenario.level} seed=${scenario.seed} ${scenario.compare || ""}`, {
    skip: !enabled, timeout: 180_000,
  }, async (t) => {
    const root = await mkdtemp(join(tmpdir(), "arc-seed-browser-"));
    const store = new AgentPlatformStore({ root });
    const browserErrors = [];
    const browser = new ManagedEpisodeBrowser({
      environment: { ...process.env, ARC_BROWSER_WIDTH: "640", ARC_BROWSER_HEIGHT: "480" },
      launchImpl: async (options) => {
        const { launch } = await import("puppeteer-core");
        const instance = await launch(options);
        const newPage = instance.newPage.bind(instance);
        instance.newPage = async () => {
          const page = await newPage();
          page.on("pageerror", (error) => browserErrors.push(error.message));
          return page;
        };
        return instance;
      },
    });
    let router;
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://localhost");
        if (await router(req, res, url)) return;
        const upstream = proxyRequest(new URL(req.url, sourceOrigin), {
          method: req.method, headers: { ...req.headers, host: new URL(sourceOrigin).host },
        }, (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        });
        upstream.on("error", () => { res.statusCode = 502; res.end("Test source proxy failed"); });
        req.pipe(upstream);
      } catch (error) {
        res.statusCode = 500;
        res.end(error.message);
      }
    });
    t.after(async () => {
      await browser.close();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      store.close();
      await rm(root, { recursive: true, force: true });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    router = createAgentPlatformRouter({
      store, gameBaseUrl: baseUrl + "/?mode=play",
      readBody: async (req) => {
        let body = "";
        for await (const chunk of req) body += chunk;
        return JSON.parse(body || "{}");
      },
    });
    const createdResponse = await fetch(baseUrl + "/api/v1/episodes", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ level: scenario.level, seed: scenario.seed, harness: "visual", view: "dual", engine: "tool" }),
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    assert.equal(new URL(created.gameUrl).searchParams.get("mode"), "agent");
    assert.equal(created.episode.seed, scenario.seed);
    assert.equal(created.episode.seedApplied, false);
    await browser.open(created.gameUrl, { baseUrl });
    const headers = { authorization: `Bearer ${created.agentToken}` };
    const path = baseUrl + `/api/v1/episodes/${created.episode.id}`;
    let status;
    const deadline = Date.now() + 75_000;
    do {
      status = await (await fetch(path + "/status", { headers })).json();
      if (status.seedVerified) break;
      await delay(250);
    } while (Date.now() < deadline);
    if (!status.seedVerified) {
      t.diagnostic(JSON.stringify({ browserErrors }));
      t.diagnostic(JSON.stringify(await browser.page.evaluate(() => ({
        ready: window.__ARC_AGENT__?.ready?.(),
        bridgeError: document.querySelector("#game-shell")?.dataset.agentBridgeError || null,
      }))));
    }
    assert.equal(status.seedVerified, true, "Browser seed evidence must be accepted by the API");
    assert.equal(status.seedApplied, !scenario.fixed);
    assert.equal(status.seed, scenario.seed);
    const observation = await (await fetch(path + "/observations/latest", { headers })).json();
    assert.match(observation.screenshot, /^data:image\/png;base64,/);
    assert.equal(observation.environment.seedApplied, !scenario.fixed);
    assert.equal(observation.environment.seed, scenario.fixed ? null : scenario.seed);
    assert.equal(status.stepCount, 0);
    if (scenario.fixed) {
      assert.equal(status.initialStateFingerprint, null);
    } else {
      assert.match(status.initialStateFingerprint, /^fnv1a64-v1:[0-9a-f]{16}$/);
      if (scenario.compare === "same") assert.equal(status.initialStateFingerprint, fingerprints.get(scenario.level));
      else if (scenario.compare === "different") assert.notEqual(status.initialStateFingerprint, fingerprints.get(scenario.level));
      else fingerprints.set(scenario.level, status.initialStateFingerprint);
    }
    if (scenario.compare === "same") {
      const commandResponse = await fetch(path + "/commands", {
        method: "POST", headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ kind: "act", action: "WAIT", durationMs: 50 }),
      });
      assert.equal(commandResponse.status, 202);
      const command = await commandResponse.json();
      let next;
      const actionDeadline = Date.now() + 30_000;
      do {
        next = await (await fetch(path + "/observations/latest", { headers })).json();
        if (next.commandId === command.id) break;
        await delay(250);
      } while (Date.now() < actionDeadline);
      assert.equal(next.commandId, command.id);
      assert.deepEqual(next.environment, observation.environment);
      assert.equal(next.step, 1);
    }
    const board = store.getLeaderboard(scenario.level);
    assert.equal(board.entries.length, 0, "Initialization tests must not create leaderboard scores");
  });
}
