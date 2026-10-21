import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");
const app = await readFile(new URL("game/app.js", root), "utf8");
const controls = await readFile(new URL("game/operator-controls.js", root), "utf8");
const styles = await readFile(new URL("operator-console.css", root), "utf8");

test("operator console preserves the ARC task HUD contract", () => {
  assert.match(html, /id="progress-meter"/);
  assert.match(html, /id="progress-fill"/);
  assert.match(html, /id="objective-title"/);
  assert.match(html, /id="terminal-overlay"/);
  assert.match(html, /id="complete-overlay"/);
  assert.match(html, /id="failure-overlay"/);
});

test("operator console exposes ARC controls without changing task actions", () => {
  for (const code of ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]) {
    assert.match(html, new RegExp(`data-control-code="${code}"`));
  }
  assert.match(html, /data-operator-action="interact"/);
  assert.match(html, /data-operator-action="reset"/);
  assert.match(html, /id="operator-stop"/);
  assert.match(app, /interact: performInteraction/);
  assert.match(app, /reset: resetGame/);
  assert.match(app, /stop: stopControlInput/);
});

test("operator controls release held input on cancellation and focus loss", () => {
  assert.match(controls, /pointercancel/);
  assert.match(controls, /lostpointercapture/);
  assert.match(controls, /button\.addEventListener\("blur"/);
  assert.match(app, /window\.addEventListener\("blur"/);
  assert.match(app, /document\.addEventListener\("visibilitychange"/);
  assert.match(styles, /\.operator-console/);
  assert.match(styles, /data-view-mode="dual"/);
});
