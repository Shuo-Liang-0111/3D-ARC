import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../game/app.js", import.meta.url), "utf8");

test("browser exposes the vendor-neutral ARC environment contract", () => {
  assert.match(source, /window\.__ARC_AGENT__ = Object\.freeze/);
  assert.match(source, /protocolVersion: "arc-env-v1"/);
  assert.match(source, /EXTERNAL_AGENT_ACTIONS.*"W".*"WAIT"/);
  assert.match(source, /EXTERNAL_AGENT_HARNESSES.*"visual".*"hybrid".*"state"/);
  assert.match(source, /executeExternalAgentAction/);
  assert.match(source, /startEpisodeBridge/);
  assert.match(source, /commands\/next/);
  assert.match(source, /observations/);
  assert.match(source, /submitObservation/);
  assert.match(source, /观察回传失败，正在重试/);
});

test("external reset and actions reuse simulation-owned behavior", () => {
  assert.match(source, /resetSimulation\(\{ force: true \}\)/);
  assert.match(source, /await executeAgentAction\(normalizedAction, normalizedDuration\)/);
  assert.doesNotMatch(source, /dispatchEvent\(new KeyboardEvent/);
});
