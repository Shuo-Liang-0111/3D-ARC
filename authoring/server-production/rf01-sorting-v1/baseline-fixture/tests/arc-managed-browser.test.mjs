import assert from "node:assert/strict";
import test from "node:test";
import {
  ManagedEpisodeBrowser,
  managedGameUrl,
  resolveChromiumExecutable,
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
    async goto(url, options) {
      calls.push(["goto", url, options]);
    },
    async waitForFunction(callback, options) {
      calls.push(["ready", typeof callback, options]);
    },
  };
  const runner = new ManagedEpisodeBrowser({
    executablePath: "/opt/chromium",
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
  assert.ok(calls[0][1].args.includes("--disable-background-timer-throttling"));
  assert.deepEqual(calls[1], ["viewport", { width: 1440, height: 900, deviceScaleFactor: 1 }]);
  assert.equal(calls[2][0], "goto");
  assert.equal(calls[3][0], "ready");

  await runner.close();
  assert.equal(closed, true);
});
