import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  G1_29DOF_JOINT_ORDER,
  MUJOCO_CONTROL_MODES,
  MujocoClient,
} from "../game/mujoco-client.js";

test("MuJoCo client queues a validated 29DOF joint command", () => {
  const client = new MujocoClient({ url: "ws://localhost/unused" });
  client.setControlMode("joint");
  client.setJointTargets(new Float32Array(29).fill(0.125), 120);
  const messages = client.pendingMessages.map((message) => JSON.parse(message));
  assert.deepEqual(messages[0], {
    type: "control_mode",
    mode: MUJOCO_CONTROL_MODES.joint,
  });
  assert.equal(messages[1].type, "joint_command");
  assert.equal(messages[1].jointOrder, G1_29DOF_JOINT_ORDER);
  assert.equal(messages[1].targets.length, 29);
  assert.equal(messages[1].durationMs, 120);
});

test("MuJoCo client rejects malformed or wrong-mode joint commands", () => {
  const client = new MujocoClient({ url: "ws://localhost/unused" });
  assert.throws(() => client.setJointTargets(new Array(29).fill(0)), /joint_position/);
  client.setControlMode("joint");
  assert.throws(() => client.setJointTargets(new Array(28).fill(0)), /exactly 29/);
  assert.throws(() => client.setJointTargets([...new Array(28).fill(0), Number.NaN]), /finite/);
  assert.throws(() => client.setJointTargets(new Array(29).fill(0), -1), /non-negative/);
});

test("level selector exposes and preserves both control versions", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../game/app.js", import.meta.url), "utf8"),
  ]);
  assert.match(html, /data-control-option="velocity"/);
  assert.match(html, /data-control-option="joint"/);
  assert.match(app, /searchParams\.get\("control"\)/);
  assert.match(app, /searchParams\.set\("control", controlModeId\)/);
  assert.match(app, /setJointTargets: \(targets, durationMs = 100\)/);
});
