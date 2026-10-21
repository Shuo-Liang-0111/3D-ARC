import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createBinModel, syncOfficeBin } from "../game/levels/rf08/bin.js";

test("RF-08 keeps Gaussian rendering in the environment only", async () => {
  const runtime = readFileSync(new URL("../game/levels/rf08/runtime.js", import.meta.url), "utf8");
  assert.ok(runtime.includes('from "./scan-scene.js"'));
  assert.ok(!runtime.includes('from "./static-scene.js"'));
  const bin = createBinModel();
  assert.equal((await bin.userData.assetReady).loaded, true);
  assert.ok(bin.children.every((child) => child.isMesh && !child.material.transparent));
  const floor = { bin: { location: "floor", x: -.82, z: 2.01, yaw: 0 }, carriedItem: null };
  const carried = { ...floor, bin: { ...floor.bin, location: "carried" }, carriedItem: "bin" };
  syncOfficeBin({ binRoot: bin }, floor);
  assert.equal(bin.visible, true);
  syncOfficeBin({ binRoot: bin }, carried);
  assert.equal(bin.visible, false);
  syncOfficeBin({ binRoot: bin }, { bin: { location: "floor", x: -1, z: 1.2, yaw: 1 } });
  assert.equal(bin.visible, true);
  assert.deepEqual(bin.position.toArray(), [-1, 0, 1.2]);
  bin.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
});
