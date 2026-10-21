import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AgentPlatformStore } from "../server/agent-platform.mjs";
import { ManagedEpisodeBrowser, resolveChromiumExecutable } from "../tools/arc-managed-browser.mjs";

const executablePath = process.env.ARC_TEST_CHROMIUM || resolveChromiumExecutable();
// This fixture has no game code, Episode HTTP routes, external resources, or model calls.
const fixture = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; font-family: sans-serif; }
  body { min-height: 1800px; background: linear-gradient(125deg, #243b70, #a73f79 55%, #e7b566); }
  canvas { position: absolute; left: 24px; top: 105px; width: calc(100vw - 48px); height: 320px; border: 7px solid #eff5ff; }
  #hud { position: fixed; z-index: 3; inset: 20px 25px auto; padding: 15px 20px; color: white; background: #142844df; border: 2px solid #72f2d1; border-radius: 17px; display: flex; justify-content: space-between; }
  #dialog { position: fixed; z-index: 5; top: 185px; left: calc(50% - 175px); width: 350px; padding: 22px; background: linear-gradient(#fefefe, #dceaf9); border: 4px solid #223757; border-radius: 14px; box-shadow: 12px 18px 15px #15203080; }
  #dialog h2 { margin: 0 0 14px; }
  #dialog button { padding: 10px 17px; color: white; background: #254bae; border: 0; border-radius: 9px; }
  #hint { position: fixed; z-index: 8; left: 30px; bottom: 25px; padding: 13px 19px; color: #132830; background: #ffee97; border: 3px dashed #993633; transform: rotate(-2deg); }
</style></head><body>
  <canvas id="world" width="1000" height="320"></canvas>
  <aside id="hud"><strong>VISIBLE HUD — step 17</strong><span>Energy 83% | W A S D</span></aside>
  <section id="dialog" role="dialog"><h2>Human-visible dialog</h2><p>This popup covers part of the canvas.</p><button>Continue</button></section>
  <div id="hint">VISIBLE TIP — turn before moving</div>
  <script>
    const ctx = document.querySelector("canvas").getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 1000, 320);
    gradient.addColorStop(0, "#16bdae"); gradient.addColorStop(1, "#42259c");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1000, 320);
    ctx.fillStyle = "#fff08a"; ctx.fillRect(75, 90, 190, 155);
    ctx.beginPath(); ctx.arc(765, 160, 83, 0, Math.PI * 2); ctx.fillStyle = "#f190ba"; ctx.fill();
    ctx.fillStyle = "#ffffff"; ctx.font = "26px sans-serif"; ctx.fillText("CANVAS CONTENT", 320, 70);
    window.captureHookBeforeReady = typeof window.__ARC_CAPTURE_VIEWPORT__ === "function";
    window.__ARC_AGENT__ = { ready: () => ({ ready: true }) };
  </script>
</body></html>`;

for (const [width, height] of [[960, 600], [1440, 900]]) {
  test(`managed viewport PNG matches the visible page and survives storage at ${width}x${height}`, { skip: !executablePath, timeout: 60_000 }, async (t) => {
    const routes = [];
    const server = http.createServer((request, response) => {
      routes.push(request.url);
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(fixture);
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => { server.closeAllConnections(); server.close(); });
    const runner = new ManagedEpisodeBrowser({
      executablePath,
      environment: { ARC_HEADLESS: "1", ARC_BROWSER_WIDTH: String(width), ARC_BROWSER_HEIGHT: String(height) },
    });
    t.after(() => runner.close());
    const url = `http://127.0.0.1:${server.address().port}/static-viewport-fixture`;
    assert.equal((await runner.open(url)).managed, true);
    const page = runner.page;
    assert.equal(await page.evaluate(() => window.captureHookBeforeReady), true);
    await page.evaluate(() => document.fonts.ready);
    const before = await page.content();
    const capture = await page.evaluate(() => window.__ARC_CAPTURE_VIEWPORT__());
    assert.match(capture, /^data:image\/png;base64,/);
    const referenceBytes = Buffer.from(await page.screenshot({ type: "png", fullPage: false, captureBeyondViewport: false }));
    const reference = `data:image/png;base64,${referenceBytes.toString("base64")}`;
    assert.equal(await page.content(), before, "capture must leave visible DOM and styles unchanged");
    const pixels = await page.evaluate(async (captured, expected) => {
      async function decode(dataUrl) {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
        return { width: canvas.width, height: canvas.height, rgba: ctx.getImageData(0, 0, canvas.width, canvas.height).data };
      }
      const actual = await decode(captured), reference = await decode(expected);
      let differentChannels = 0;
      for (let i = 0; i < actual.rgba.length; i += 1) if (actual.rgba[i] !== reference.rgba[i]) differentChannels += 1;
      return { width: actual.width, height: actual.height, referenceWidth: reference.width, referenceHeight: reference.height, differentChannels };
    }, capture, reference);
    assert.deepEqual(pixels, { width, height, referenceWidth: width, referenceHeight: height, differentChannels: 0 });
    assert.deepEqual(Buffer.from(capture.split(",")[1], "base64"), referenceBytes);

    // Only a disposable store is used; no production Episode or API is contacted.
    const root = await mkdtemp(join(tmpdir(), "arc-viewport-roundtrip-"));
    const store = new AgentPlatformStore({ root });
    t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }); });
    for (const harness of ["visual", "hybrid"]) {
      const created = store.createEpisode({ harness, gameBaseUrl: "http://synthetic.invalid/" });
      const browserToken = new URL(created.gameUrl).searchParams.get("browser_token");
      await store.submitObservation(created.episode.id, browserToken, { status: "NOT_FINISHED", harness, screenshot: capture });
      const observation = await store.getLatestObservation(created.episode.id, created.agentToken);
      assert.equal(observation.screenshot, capture, `${harness} PNG data URL must be returned unchanged`);
      assert.deepEqual(Buffer.from(observation.screenshot.split(",")[1], "base64"), referenceBytes);
    }
    assert.ok(routes.every((route) => !route.startsWith("/api/")), "the browser must not contact an Episode API");
  });
}


for (const [name, binary, client, harness] of [
  ["Node.js", process.execPath, "../public/agent-kit/node-agent.mjs", "hybrid"],
  ["Python", "python3", "../public/agent-kit/python-agent.py", "visual"],
]) {
  test(`${name} starter opens the real managed-browser CLI for a synthetic terminal page`, { skip: !executablePath, timeout: 30_000 }, async (t) => {
    let origin;
    let pageOpened = false;
    let observations = 0;
    let modelRequests = 0;
    const failures = [];
    const server = http.createServer(async (request, response) => {
      try {
        response.setHeader("content-type", "application/json");
        if (request.url === "/api/v1/episodes") {
          assert.equal(request.method, "POST");
          for await (const _chunk of request) {} // The fixture creates no actual Episode.
          response.end(JSON.stringify({ episode: { id: "synthetic-terminal" }, agentToken: "synthetic-token", gameUrl: `${origin}/static-fixture?browser_token=private-fixture-token` }));
        } else if (request.url.startsWith("/static-fixture")) {
          pageOpened = true;
          response.setHeader("content-type", "text/html");
          response.end(fixture);
        } else if (request.url === "/api/v1/episodes/synthetic-terminal/observations/latest") {
          assert.equal(pageOpened, true, "managed browser must navigate before starter reads observations");
          observations += 1;
          response.end(JSON.stringify({ status: "GAME_OVER" }));
        } else if (request.url === "/model") {
          modelRequests += 1;
          assert.fail("terminal synthetic page must not request a model");
        } else {
          response.end("{}");
        }
      } catch (error) {
        failures.push(error);
        response.statusCode = 500;
        response.end("{}");
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    origin = `http://127.0.0.1:${server.address().port}`;
    t.after(() => { server.closeAllConnections(); server.close(); });
    const child = spawn(binary, [fileURLToPath(new URL(client, import.meta.url))], {
      env: {
        PATH: process.env.PATH,
        ARC_AGENT_API_URL: origin,
        MODEL_API_URL: `${origin}/model`,
        MODEL_API_KEY: "synthetic-model-key",
        MODEL_NAME: "synthetic-model",
        ARC_HARNESS: harness,
        ARC_CHROMIUM_EXECUTABLE: executablePath,
        ARC_BROWSER_WIDTH: "960",
        ARC_BROWSER_HEIGHT: "600",
        NODE_BINARY: process.execPath,
        NO_PROXY: "127.0.0.1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
    const timeout = setTimeout(() => child.kill("SIGTERM"), 20_000);
    t.after(() => clearTimeout(timeout));
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const [code] = await once(child, "close");
    assert.deepEqual(failures, [], output);
    assert.equal(code, 0, output);
    assert.equal(observations, 1);
    assert.equal(modelRequests, 0);
    assert.match(output, /managed browser ready; original viewport PNG capture enabled/);
    assert.match(output, /Episode finished: GAME_OVER after 0 actions/);
    assert.doesNotMatch(output, /private-fixture-token|synthetic-model-key/);
  });
}
