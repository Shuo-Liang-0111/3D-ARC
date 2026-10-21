import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createBinModel, syncOfficeBin } from "../game/levels/rf08/bin.js";

test("RF-08 static GLB embeds textures and contains no Gaussian extensions", () => {
  const buffer = readFileSync(new URL("../public/office-scan/office-static.glb", import.meta.url));
  assert.equal(buffer.toString("utf8", 0, 4), "glTF");
  const document = JSON.parse(buffer.toString("utf8", 20, 20 + buffer.readUInt32LE(12)));
  assert.ok(document.meshes.length >= 18);
  assert.ok(document.images.length >= 18);
  assert.ok(document.images.every((image) => Number.isInteger(image.bufferView)));
  assert.ok(document.materials.every((material) => material.pbrMetallicRoughness.baseColorTexture || material.pbrMetallicRoughness.baseColorFactor));
  const painted = document.materials.find((material) => material.name === "RF08_Uniform_Painted_Surface");
  assert.ok(painted?.pbrMetallicRoughness.baseColorFactor, "painted surfaces use a uniform color");
  assert.ok(!(document.extensionsUsed ?? []).some((extension) => /splat|gaussian/i.test(extension)));
});

test("RF-08 bin has only opaque mesh visuals and follows floor/carry transitions", async () => {
  const root = createBinModel();
  assert.equal((await root.userData.assetReady).loaded, true);
  assert.ok(root.children.length > 0);
  assert.ok(root.children.every((child) => child.isMesh && !child.material.transparent));
  syncOfficeBin({ binRoot: root }, { bin: { location: "carried", x: -.82, z: 2.01, yaw: 0 } });
  assert.equal(root.visible, false);
  syncOfficeBin({ binRoot: root }, { bin: { location: "floor", x: -1.4, z: 1.3, yaw: 1.2 } });
  assert.equal(root.visible, true);
  assert.deepEqual(root.position.toArray(), [-1.4, 0, 1.3]);
  assert.equal(root.rotation.y, 1.2);
  root.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
});
