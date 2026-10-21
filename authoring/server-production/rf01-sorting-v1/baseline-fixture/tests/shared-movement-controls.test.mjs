import test from "node:test";
import assert from "node:assert/strict";
import * as rf01 from "../game/engine.js";
import * as rf02 from "../game/levels/rf02/engine.js";
import * as rf03 from "../game/levels/rf03/engine.js";
import * as rf04 from "../game/levels/rf04/engine.js";
import * as rf05 from "../game/levels/rf05/engine.js";
import * as rf06 from "../game/levels/rf06/engine.js";
import * as rf07 from "../game/levels/rf07/engine.js";
import * as rf08 from "../game/levels/rf08/engine.js";
import * as rf09 from "../game/levels/rf09/engine.js";

const levels = { rf01, rf02, rf03, rf04, rf05, rf06, rf07, rf08, rf09 };

for (const [id, engine] of Object.entries(levels)) {
  test(`${id} supports energy-consuming lateral movement`, () => {
    const initial = engine.createInitialState();
    const moved = engine.updateMovement(initial, { move: 0, strafe: 1, turn: 0 }, 0.05);
    assert.equal(moved.player.yaw, initial.player.yaw);
    assert.ok(Math.hypot(moved.player.x - initial.player.x, moved.player.z - initial.player.z) > 0);
    assert.ok(moved.progress < initial.progress);
  });

  test(`${id} supports energy-free Q/E turning`, () => {
    const initial = engine.createInitialState();
    const turned = engine.updateMovement(initial, { move: 0, strafe: 0, turn: 1, drain: false }, 0.05);
    assert.notEqual(turned.player.yaw, initial.player.yaw);
    assert.equal(turned.player.x, initial.player.x);
    assert.equal(turned.player.z, initial.player.z);
    assert.equal(turned.progress, initial.progress);
    assert.equal(turned.motion, "turning");
  });
}

test("browser controls map A/D to strafe and Q/E to free turning", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../game/app.js", import.meta.url), "utf8"));
  assert.ok(source.includes('A: { move: 0, strafe: 1, turn: 0 }'));
  assert.ok(source.includes('D: { move: 0, strafe: -1, turn: 0 }'));
  assert.ok(source.includes('if (keys.has("KeyA")) strafe += 1;'));
  assert.ok(source.includes('if (keys.has("KeyD")) strafe -= 1;'));
  assert.ok(source.includes('if (keys.has("KeyQ")) turn += 1;'));
  assert.ok(source.includes('if (keys.has("KeyE")) turn -= 1;'));
  assert.ok(source.includes("drain: move !== 0 || strafe !== 0"));
  assert.ok(source.includes('if (event.code === "KeyF" && !event.repeat) performInteraction();'));
  assert.ok(source.includes('EXTERNAL_AGENT_ACTIONS = Object.freeze(["W", "A", "S", "D", "E", "WAIT"])'));
});
