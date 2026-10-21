import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter, once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runInNewContext } from "node:vm";
import {
  ManagedEpisodeBrowser,
  managedGameUrl,
  resolveChromiumExecutable,
  runManagedBrowserCli,
} from "../tools/arc-managed-browser.mjs";

test("managed browser rewrites public game URLs to the local ARC service", () => {
  const result = new URL(managedGameUrl(
    "http://49.233.44.228:4175/?episode=episode-1&browser_token=secret",
    "http://127.0.0.1:4175",
  ));
  assert.equal(result.origin, "http://127.0.0.1:4175");
  assert.equal(result.searchParams.get("episode"), "episode-1");
  assert.equal(result.searchParams.get("browser_token"), "secret");
});

test("managed browser honors an explicit Chromium executable", () => {
  assert.equal(resolveChromiumExecutable({ explicitPath: "/opt/chromium" }), "/opt/chromium");
});

test("managed browser launches one isolated page and closes it", async () => {
  const calls = [];
  let closed = false;
  const page = {
    async setViewport(viewport) {
      calls.push(["viewport", viewport]);
    },
    async exposeFunction(name, callback) {
      calls.push(["binding", name, typeof callback]);
    },
    async goto(url, options) {
      calls.push(["goto", url, options]);
    },
    async waitForFunction(callback, options) {
      calls.push(["ready", typeof callback, options]);
    },
  };
  const runner = new ManagedEpisodeBrowser({
    executablePath: "/opt/chromium",
    environment: {},
    platform: "linux",
    launchImpl: async (options) => {
      calls.push(["launch", options]);
      return {
        newPage: async () => page,
        close: async () => {
          closed = true;
        },
      };
    },
  });

  const opened = await runner.open(
    "http://public.test:4175/?episode=episode-1",
    { baseUrl: "http://127.0.0.1:4175" },
  );
  assert.equal(opened.managed, true);
  assert.equal(new URL(opened.url).hostname, "127.0.0.1");
  assert.equal(calls[0][0], "launch");
  assert.equal(calls[0][1].headless, true);
  assert.ok(!calls[0][1].args.some((arg) => /swiftshader|ignore-gpu-blocklist/.test(arg)));
  assert.ok(calls[0][1].args.includes("--disable-background-timer-throttling"));
  assert.deepEqual(calls[1], ["viewport", { width: 1440, height: 900, deviceScaleFactor: 1 }]);
  assert.deepEqual(calls[2], ["binding", "__ARC_CAPTURE_VIEWPORT__", "function"]);
  assert.equal(calls[3][0], "goto");
  assert.equal(calls[4][0], "ready");

  await runner.close();
  assert.equal(closed, true);
});

test("managed browser discovers macOS Chrome application installs", () => {
  for (const executable of [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Users/project-user/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ]) {
    assert.equal(resolveChromiumExecutable({
      environment: {},
      homeDirectory: "/Users/project-user",
      existsImpl: (candidate) => candidate === executable,
    }), executable);
  }
});

test("managed browser discovers current Playwright caches on macOS and Linux", () => {
  for (const [cache, executable] of [
    [".cache/ms-playwright", "chrome-linux64/chrome"],
    [".cache/ms-playwright", "chrome-linux/chrome"],
    ["Library/Caches/ms-playwright", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"],
    ["Library/Caches/ms-playwright", "chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium"],
    ["Library/Caches/ms-playwright", "chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"],
  ]) {
    const homeDirectory = mkdtempSync(join(tmpdir(), "arc-browser-test-"));
    try {
      for (const revision of [999, 1000]) {
        const file = join(homeDirectory, cache, `chromium-${revision}`, executable);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, "");
      }
      assert.equal(
        resolveChromiumExecutable({ environment: {}, homeDirectory }),
        join(homeDirectory, cache, "chromium-1000", executable),
      );
    } finally {
      rmSync(homeDirectory, { recursive: true, force: true });
    }
  }
});

function mockRunner({ environment = {}, platform = "linux", failAt } = {}) {
  const calls = { closed: 0, killed: 0, unref: 0 };
  const inhibitor = new EventEmitter();
  inhibitor.kill = () => { calls.killed += 1; };
  inhibitor.unref = () => { calls.unref += 1; };
  const page = {
    async setViewport(viewport) { calls.viewport = viewport; },
    async exposeFunction(name, callback) {
      calls.bindingName = name;
      calls.capture = callback;
      if (failAt === "binding") throw new Error("binding failed");
    },
    async screenshot(options) {
      calls.screenshotOptions = options;
      if (failAt === "screenshot") throw new Error("screenshot failed");
      return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
    },
    async evaluate() { throw new Error("capture must not read or alter the DOM"); },
    async addScriptTag() { throw new Error("capture must not inject DOM elements"); },
    async addStyleTag() { throw new Error("capture must not restyle the viewport"); },
    async goto(url) {
      calls.url = url;
      if (failAt === "goto") throw new Error("navigation failed");
    },
    async waitForFunction(callback) {
      calls.readyCallback = callback;
      if (failAt === "ready") throw new Error("bridge timeout");
    },
  };
  const browser = new EventEmitter();
  browser.newPage = async () => page;
  browser.close = async () => {
    calls.closed += 1;
    browser.emit("disconnected");
  };
  const runner = new ManagedEpisodeBrowser({
    executablePath: "/opt/chromium",
    environment,
    platform,
    launchImpl: async (options) => {
      calls.launch = options;
      if (failAt === "launch") throw new Error("launch failed");
      return browser;
    },
    spawnImpl: (...args) => {
      calls.spawn = args;
      return inhibitor;
    },
  });
  return { runner, calls, browser, page, inhibitor };
}

test("software rendering is explicit and viewport/headful overrides are honored", async () => {
  const { runner, calls } = mockRunner({
    environment: {
      ARC_SOFTWARE_RENDERING: "1",
      ARC_BROWSER_WIDTH: "1920",
      ARC_BROWSER_HEIGHT: "1080",
      ARC_HEADLESS: "0",
      ARC_MANAGED_GAME_URL: "http://local.test:4173",
    },
  });
  await runner.open("http://public.test/?episode=test");
  assert.equal(calls.launch.headless, false);
  assert.ok(calls.launch.args.includes("--use-angle=swiftshader"));
  assert.ok(calls.launch.args.includes("--enable-unsafe-swiftshader"));
  assert.deepEqual(calls.viewport, { width: 1920, height: 1080, deviceScaleFactor: 1 });
  assert.equal(new URL(calls.url).origin, "http://local.test:4173");
  assert.equal(calls.spawn, undefined);
  await runner.close();
});

test("invalid viewport overrides retain valid screenshot dimensions", async () => {
  for (const [width, height, expected] of [
    ["invalid", "Infinity", { width: 1440, height: 900, deviceScaleFactor: 1 }],
    ["320", "240", { width: 640, height: 480, deviceScaleFactor: 1 }],
  ]) {
    const { runner, calls } = mockRunner({ environment: { ARC_BROWSER_WIDTH: width, ARC_BROWSER_HEIGHT: height } });
    await runner.open("http://game.test/");
    assert.deepEqual(calls.viewport, expected);
    await runner.close();
  }
});

test("open waits for public ARC readiness before returning", async () => {
  const { runner, calls, page } = mockRunner();
  let signalWaiting;
  const waiting = new Promise((resolve) => { signalWaiting = resolve; });
  let releaseReady;
  const ready = new Promise((resolve) => { releaseReady = resolve; });
  const originalWait = page.waitForFunction;
  page.waitForFunction = async (callback, options) => {
    await originalWait(callback, options);
    signalWaiting();
    await ready;
  };
  let opened = false;
  const opening = runner.open("http://game.test/").then(() => { opened = true; });
  await waiting;
  assert.equal(opened, false);
  assert.equal(runner.page, null);
  const checkReady = (window) => runInNewContext(`(${calls.readyCallback})()`, { window });
  assert.equal(checkReady({}), false);
  assert.equal(checkReady({ __ARC_AGENT__: { ready: () => ({ ready: false }) } }), false);
  assert.equal(checkReady({ __ARC_AGENT__: { ready: () => ({ ready: true }) } }), true);
  releaseReady();
  await opening;
  assert.equal(runner.page, page);
  await runner.close();
});

test("macOS idle-sleep inhibition is scoped to the managed browser", async () => {
  const { runner, calls } = mockRunner({ platform: "darwin" });
  await runner.open("http://game.test/");
  assert.deepEqual(calls.spawn, ["/usr/bin/caffeinate", ["-i", "-w", String(process.pid)], { stdio: "ignore" }]);
  assert.equal(calls.unref, 1);
  assert.equal(calls.killed, 0);
  await runner.close();
  await runner.close();
  assert.equal(calls.killed, 1);
  assert.equal(calls.closed, 1);
});

test("macOS idle-sleep inhibition is released after browser disconnection", async () => {
  const { runner, browser, calls } = mockRunner({ platform: "darwin" });
  await runner.open("http://game.test/");
  browser.emit("disconnected");
  assert.equal(calls.killed, 1);
  await runner.close();
  assert.equal(calls.killed, 1);
});

test("browser startup failures release macOS idle-sleep inhibition", async () => {
  for (const failAt of ["launch", "binding", "goto", "ready"]) {
    const { runner, calls } = mockRunner({ platform: "darwin", failAt });
    await assert.rejects(runner.open("http://game.test/"), /failed|timeout/);
    assert.equal(calls.killed, 1, failAt);
    assert.equal(calls.closed, failAt === "launch" ? 0 : 1, failAt);
    assert.equal(runner.browser, null);
    assert.equal(runner.page, null);
    await runner.close();
    assert.equal(calls.killed, 1, failAt);
  }
});

test("an unavailable macOS sleep utility does not crash the browser runner", async () => {
  const { runner, inhibitor, calls } = mockRunner({ platform: "darwin" });
  await runner.open("http://game.test/");
  inhibitor.emit("error", new Error("spawn ENOENT"));
  await runner.close();
  assert.equal(calls.closed, 1);
});

test("public capture hook returns the unmodified PNG viewport screenshot", async () => {
  const { runner, calls } = mockRunner();
  await runner.open("http://game.test/");
  assert.equal(calls.bindingName, "__ARC_CAPTURE_VIEWPORT__");
  const dataUrl = await calls.capture();
  assert.equal(dataUrl, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==");
  assert.deepEqual(
    Buffer.from(dataUrl.split(",")[1], "base64").subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  assert.deepEqual(calls.screenshotOptions, {
    type: "png",
    encoding: "base64",
    fullPage: false,
    captureBeyondViewport: false,
  });
  assert.deepEqual(calls.viewport, { width: 1440, height: 900, deviceScaleFactor: 1 });
  await runner.close();
  assert.equal(calls.closed, 1);
});

test("public capture hook propagates screenshot errors without returning a replacement image", async () => {
  const { runner, calls } = mockRunner({ failAt: "screenshot" });
  await runner.open("http://game.test/");
  await assert.rejects(calls.capture(), /screenshot failed/);
  await runner.close();
  assert.equal(calls.closed, 1);
});

function mockBrowserCli({ openImpl } = {}) {
  const input = new PassThrough();
  const output = new PassThrough();
  const signals = new EventEmitter();
  const calls = { output: "", opened: [], closed: 0, finished: false };
  output.on("data", (chunk) => { calls.output += chunk; });
  const browserEvents = new EventEmitter();
  const browser = {
    browser: browserEvents,
    async open(gameUrl) {
      calls.opened.push(gameUrl);
      await openImpl?.(gameUrl);
    },
    async close() { calls.closed += 1; },
  };
  const finished = runManagedBrowserCli({ input, output, signals, createBrowser: () => browser })
    .then((code) => { calls.finished = true; return code; });
  return { input, output, signals, calls, finished, browserEvents };
}

test("browser CLI accepts the URL only from the first stdin line and stays alive until EOF", async () => {
  const cli = mockBrowserCli();
  const ready = once(cli.output, "data");
  cli.input.write("http://game.test/?browser_token=private");
  await new Promise(setImmediate);
  assert.deepEqual(cli.calls.opened, []);
  cli.input.write("-token\nignored-second-line\n");
  await ready;
  assert.deepEqual(cli.calls.opened, ["http://game.test/?browser_token=private-token"]);
  assert.equal(cli.calls.output, '{"ready":true}\n');
  assert.equal(cli.calls.finished, false);
  cli.input.end();
  assert.equal(await cli.finished, 0);
  assert.ok(cli.calls.closed >= 1);
  assert.equal(cli.signals.listenerCount("SIGTERM"), 0);
  assert.equal(cli.signals.listenerCount("SIGINT"), 0);
});

test("browser CLI closes on SIGINT and SIGTERM", async () => {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    const cli = mockBrowserCli();
    const ready = once(cli.output, "data");
    cli.input.write("http://game.test/\n");
    await ready;
    cli.signals.emit(signal);
    assert.equal(await cli.finished, 0);
    assert.ok(cli.calls.closed >= 1, signal);
    cli.input.destroy();
  }
});

test("browser CLI does not launch after parent EOF before receiving a URL", async () => {
  const cli = mockBrowserCli();
  cli.input.end();
  assert.equal(await cli.finished, 0);
  assert.deepEqual(cli.calls.opened, []);
  assert.equal(cli.calls.output, "");
});

test("browser CLI reports startup failures without leaking the URL or browser token", async () => {
  const cli = mockBrowserCli({
    openImpl: async (gameUrl) => { throw new Error("Navigation failed: " + gameUrl); },
  });
  cli.input.write("http://game.test/?browser_token=private-token\n");
  assert.equal(await cli.finished, 1);
  assert.equal(cli.calls.output, '{"ready":false,"error":"managed_browser_startup_failed"}\n');
  assert.ok(cli.calls.closed >= 1);
  cli.input.destroy();
});

test("browser CLI closes a launch that finishes after the parent has exited", async () => {
  let completeLaunch;
  const launching = new Promise((resolve) => { completeLaunch = resolve; });
  const cli = mockBrowserCli({ openImpl: () => launching });
  cli.input.write("http://game.test/?browser_token=private-token\n");
  await new Promise(setImmediate);
  assert.equal(cli.calls.opened.length, 1);
  cli.input.end();
  await new Promise(setImmediate);
  assert.ok(cli.calls.closed >= 1);
  completeLaunch();
  assert.equal(await cli.finished, 0);
  assert.ok(cli.calls.closed >= 2);
  assert.equal(cli.calls.output, "");
});

test("browser CLI exits when its managed browser disconnects", async () => {
  const cli = mockBrowserCli();
  const ready = once(cli.output, "data");
  cli.input.write("http://game.test/\n");
  await ready;
  cli.browserEvents.emit("disconnected");
  assert.equal(await cli.finished, 1);
  assert.ok(cli.calls.closed >= 1);
  cli.input.destroy();
});

test("managed browser module imports without running the CLI", () => {
  const moduleUrl = new URL("../tools/arc-managed-browser.mjs", import.meta.url).href;
  const result = spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    `await import(${JSON.stringify(moduleUrl)}); console.log("imported");`,
  ], { encoding: "utf8", input: "" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "imported\n");
  assert.equal(result.stderr, "");
});

test("browser CLI validates its fixed flag without accepting a game URL in argv", () => {
  const file = fileURLToPath(new URL("../tools/arc-managed-browser.mjs", import.meta.url));
  const invalid = spawnSync(process.execPath, [file], { encoding: "utf8", input: "" });
  assert.equal(invalid.status, 2);
  assert.equal(invalid.stdout, "");
  assert.equal(invalid.stderr, "Usage: node arc-managed-browser.mjs --game-url-stdin\n");
  const ended = spawnSync(process.execPath, [file, "--game-url-stdin"], { encoding: "utf8", input: "" });
  assert.equal(ended.status, 0, ended.stderr);
  assert.equal(ended.stdout, "");
});

test("browser CLI executable completes its stdin handshake with a mocked browser process", { timeout: 5000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "arc-browser-cli-test-"));
  const executable = join(directory, "chromium-placeholder");
  const entry = join(directory, "puppeteer-mock.mjs");
  const closed = join(directory, "closed");
  const file = fileURLToPath(new URL("../tools/arc-managed-browser.mjs", import.meta.url));
  let child;
  try {
    writeFileSync(executable, "");
    writeFileSync(entry, `
      import { writeFileSync } from "node:fs";
      export async function launch() {
        return {
          async newPage() {
            return {
              async setViewport() {},
              async exposeFunction() {},
              async goto() {},
              async waitForFunction() {},
            };
          },
          async close() { writeFileSync(${JSON.stringify(closed)}, "closed"); },
        };
      }
    `);
    child = spawn(process.execPath, [file, "--game-url-stdin"], {
      env: { ...process.env, ARC_CHROMIUM_EXECUTABLE: executable, ARC_PUPPETEER_ENTRY: entry },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const handshake = once(child.stdout, "data");
    const exited = once(child, "exit");
    child.stdin.write("http://mock-game.test/?browser_token=private-token\n");
    await handshake;
    assert.equal(stdout, '{"ready":true}\n');
    assert.equal(child.exitCode, null);
    child.stdin.end();
    const [code, signal] = await exited;
    assert.equal(code, 0, stderr);
    assert.equal(signal, null);
    assert.equal(stderr, "");
    assert.equal(stdout, '{"ready":true}\n');
    assert.equal(readFileSync(closed, "utf8"), "closed");
  } finally {
    if (child && child.exitCode === null) child.kill("SIGKILL");
    rmSync(directory, { recursive: true, force: true });
  }
});
